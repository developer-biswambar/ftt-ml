# reconciliation_service_fix.py - Fix for NaN/Infinity JSON serialization issues

import math

import numpy as np


def safe_float(value):
    """Convert float to JSON-safe value"""
    if value is None:
        return None
    if isinstance(value, (int, str)):
        return value
    if math.isnan(value) or math.isinf(value):
        return None
    return float(value)


def safe_dict(data):
    """Recursively convert all float values in a dict to JSON-safe values"""
    if isinstance(data, dict):
        return {k: safe_dict(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [safe_dict(item) for item in data]
    elif isinstance(data, float):
        return safe_float(data)
    elif isinstance(data, np.float64) or isinstance(data, np.float32):
        return safe_float(float(data))
    elif isinstance(data, np.int64) or isinstance(data, np.int32):
        return int(data)
    else:
        return data


# Updated process_reconciliation function with safe JSON handling
async def process_reconciliation(reconciliation_id: str, request: ReconciliationRequest):
    """Process reconciliation with enhanced filtering, extraction, and reporting"""
    start_time = datetime.utcnow()

    try:
        # Update status
        reconciliations[reconciliation_id]["status"] = "processing"

        # Get file data
        file_a_data = uploaded_files.get(request.file_a_id)
        file_b_data = uploaded_files.get(request.file_b_id)

        if not file_a_data or not file_b_data:
            raise ValueError("One or both files not found")

        df_a = file_a_data["data"]
        df_b = file_b_data["data"]

        logger.info(
            f"Processing reconciliation between {file_a_data['info']['filename']} and {file_b_data['info']['filename']}")

        # Initialize pattern detector
        detector = FinancialPatternDetector()

        # Analyze file schemas with pattern detection
        logger.info("Analyzing file patterns...")
        schema_a = await analyze_file_schema(df_a, detector)
        schema_b = await analyze_file_schema(df_b, detector)

        # Generate reconciliation rules
        if request.match_columns:
            # Convert manual mappings to rules
            rules = []
            for mapping in request.match_columns:
                rules.append(ReconciliationRule(
                    rule_type="match",
                    source_column=mapping.get("file_a_column"),
                    target_column=mapping.get("file_b_column"),
                    operation=mapping.get("operation", "exact"),
                    parameters=mapping.get("parameters", {}),
                    confidence=0.9,
                    description="User-defined mapping"
                ))
        else:
            # Generate rules using LLM with pattern analysis
            logger.info("Generating reconciliation rules...")
            rules = await generate_reconciliation_rules(schema_a, schema_b, request.user_requirements)

        logger.info(f"Generated {len(rules)} reconciliation rules")

        # Log rule types for debugging
        rule_types = {}
        for rule in rules:
            rule_types[rule.rule_type] = rule_types.get(rule.rule_type, 0) + 1
        logger.info(f"Rule distribution: {rule_types}")

        # Apply reconciliation rules
        logger.info("Applying reconciliation rules...")
        result = await apply_reconciliation_rules(df_a, df_b, rules)

        # Save results to storage
        logger.info("Saving reconciliation results...")
        saved_files = await save_reconciliation_results(reconciliation_id, result, uploaded_files)

        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()

        # Calculate amount differences safely
        amount_diff_stats = {}
        if 'amount_difference' in result["matched_records"].columns and len(result["matched_records"]) > 0:
            amount_diffs = result["matched_records"]['amount_difference'].dropna()
            if len(amount_diffs) > 0:
                amount_diff_stats = {
                    "records_with_differences": len(amount_diffs),
                    "average_difference": safe_float(amount_diffs.mean()),
                    "max_difference": safe_float(amount_diffs.max()),
                    "min_difference": safe_float(amount_diffs.min()),
                    "total_absolute_difference": safe_float(amount_diffs.abs().sum())
                }
            else:
                amount_diff_stats = {
                    "records_with_differences": 0,
                    "average_difference": None,
                    "max_difference": None,
                    "min_difference": None,
                    "total_absolute_difference": None
                }
        else:
            amount_diff_stats = {
                "records_with_differences": 0,
                "average_difference": None
            }

        # Update reconciliation record with safe values
        reconciliation_update = {
            "status": "completed",
            "result": {
                "matched_count": int(result["match_statistics"]["matched_count"]),
                "unmatched_file_a_count": int(result["match_statistics"]["unmatched_file_a_count"]),
                "unmatched_file_b_count": int(result["match_statistics"]["unmatched_file_b_count"]),
                "match_rate": safe_float(result["match_statistics"]["match_rate"]),
                "match_confidence_avg": safe_float(result["match_statistics"].get("match_confidence_avg", 0)),
                "filter_impact": {
                    "file_a": result["match_statistics"]["filter_impact_a"],
                    "file_b": result["match_statistics"]["filter_impact_b"]
                },
                "matched_records": safe_dict(result["matched_records"].to_dict('records')[:100]),  # First 100 matches
                "unmatched_file_a": safe_dict(
                    result["unmatched_file_a"].to_dict('records')[:50]) if request.output_unmatched else [],
                "unmatched_file_b": safe_dict(
                    result["unmatched_file_b"].to_dict('records')[:50]) if request.output_unmatched else [],
                "applied_rules": [safe_dict(rule.dict()) for rule in rules],
                "saved_files": saved_files,
                "pattern_analysis": {
                    "file_a": {col: info['patterns'] for col, info in schema_a['column_analysis'].items()},
                    "file_b": {col: info['patterns'] for col, info in schema_b['column_analysis'].items()}
                },
                "amount_differences": amount_diff_stats
            },
            "processing_time": safe_float(processing_time),
            "completed_at": datetime.utcnow().isoformat()
        }

        reconciliations[reconciliation_id].update(reconciliation_update)

        logger.info(f"Reconciliation {reconciliation_id} completed successfully in {processing_time:.2f}s")

    except Exception as e:
        logger.error(f"Reconciliation failed for {reconciliation_id}: {e}")
        reconciliations[reconciliation_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })


# Updated apply_reconciliation_rules to handle NaN values
async def apply_reconciliation_rules(df_a: pd.DataFrame, df_b: pd.DataFrame,
                                     rules: List[ReconciliationRule]) -> Dict[str, Any]:
    """Apply reconciliation rules with filtering, extraction, and comprehensive reporting"""

    # Step 1: Apply filter rules
    filter_rules = [r for r in rules if r.rule_type == 'filter']
    if filter_rules:
        logger.info(f"Applying {len(filter_rules)} filter rules...")
        df_a_filtered = await apply_filter_rules(df_a, filter_rules, 'file_a')
        df_b_filtered = await apply_filter_rules(df_b, filter_rules, 'file_b')
    else:
        df_a_filtered = df_a.copy()
        df_b_filtered = df_b.copy()

    # Step 2: Apply extract rules
    extract_rules = [r for r in rules if r.rule_type == 'extract']
    if extract_rules:
        logger.info(f"Applying {len(extract_rules)} extract rules...")
        df_a_processed = await apply_extract_rules(df_a_filtered, extract_rules, 'a')
        df_b_processed = await apply_extract_rules(df_b_filtered, extract_rules, 'b')
    else:
        df_a_processed = df_a_filtered.copy()
        df_b_processed = df_b_filtered.copy()

    # Step 3: Apply transformation rules
    transform_rules = [r for r in rules if r.rule_type == 'transform']
    for rule in transform_rules:
        transformation = rule.parameters.get('transformation', '')
        if rule.source_column in df_a_processed.columns:
            col_name = f"{rule.source_column}_transformed"
            df_a_processed[col_name] = df_a_processed[rule.source_column].apply(
                lambda x: apply_transformation(x, transformation, rule.parameters)
            )
        if rule.target_column and rule.target_column in df_b_processed.columns:
            col_name = f"{rule.target_column}_transformed"
            df_b_processed[col_name] = df_b_processed[rule.target_column].apply(
                lambda x: apply_transformation(x, transformation, rule.parameters)
            )

    # Step 4: Apply matching rules
    match_rules = [r for r in rules if r.rule_type == 'match']
    matched_indices_a = set()
    matched_indices_b = set()
    matches = []

    # Sort rules by confidence (highest first)
    match_rules.sort(key=lambda x: x.confidence, reverse=True)

    for rule in match_rules:
        source_col = rule.source_column
        target_col = rule.target_column

        # Check for transformed columns
        if f"{source_col}_transformed" in df_a_processed.columns:
            source_col = f"{source_col}_transformed"
        if f"{target_col}_transformed" in df_b_processed.columns:
            target_col = f"{target_col}_transformed"

        # Skip if columns don't exist
        if source_col not in df_a_processed.columns or target_col not in df_b_processed.columns:
            continue

        # Perform matching
        for idx_a, row_a in df_a_processed.iterrows():
            if idx_a in matched_indices_a:
                continue

            value_a = row_a[source_col]
            if pd.isna(value_a) or value_a == '':
                continue

            for idx_b, row_b in df_b_processed.iterrows():
                if idx_b in matched_indices_b:
                    continue

                value_b = row_b[target_col]
                if pd.isna(value_b) or value_b == '':
                    continue

                # Check for match
                if is_match(value_a, value_b, rule):
                    # Calculate amount difference if amount columns exist
                    amount_diff = None
                    amount_a = None
                    amount_b = None

                    # Find amount columns
                    for col in df_a_processed.columns:
                        if 'amount' in col.lower() or 'value' in col.lower():
                            try:
                                amount_a = float(
                                    str(row_a[col]).replace(',', '').replace('$', '').replace('€', '').replace('£', ''))
                                break
                            except:
                                pass

                    for col in df_b_processed.columns:
                        if 'amount' in col.lower() or 'value' in col.lower():
                            try:
                                amount_b = float(
                                    str(row_b[col]).replace(',', '').replace('$', '').replace('€', '').replace('£', ''))
                                break
                            except:
                                pass

                    if amount_a is not None and amount_b is not None:
                        amount_diff = amount_b - amount_a

                    matches.append({
                        'index_a': idx_a,
                        'index_b': idx_b,
                        'matched_on': f"{rule.source_column} = {value_a}",
                        'match_type': rule.operation,
                        'confidence': rule.confidence,
                        'amount_a': amount_a,
                        'amount_b': amount_b,
                        'amount_difference': amount_diff,
                        'rule_description': rule.description
                    })

                    matched_indices_a.add(idx_a)
                    matched_indices_b.add(idx_b)
                    break

    # Create comprehensive result dataframes
    matched_records = []
    for match in matches:
        row_a = df_a.loc[match['index_a']]
        row_b = df_b.loc[match['index_b']]

        matched_row = {}
        # Add all columns from file A with prefix
        for col in df_a.columns:
            matched_row[f"FileA_{col}"] = row_a[col]

        # Add all columns from file B with prefix
        for col in df_b.columns:
            matched_row[f"FileB_{col}"] = row_b[col]

        # Add match metadata
        matched_row['match_type'] = match['match_type']
        matched_row['matched_on'] = match['matched_on']
        matched_row['confidence'] = match['confidence']
        matched_row['amount_difference'] = match['amount_difference']
        matched_row['rule_description'] = match.get('rule_description', '')

        matched_records.append(matched_row)

    matched_df = pd.DataFrame(matched_records)
    unmatched_a = df_a[~df_a.index.isin(matched_indices_a)]
    unmatched_b = df_b[~df_b.index.isin(matched_indices_b)]

    # Calculate statistics with safe values
    total_a_original = len(df_a)
    total_b_original = len(df_b)
    total_a_filtered = len(df_a_filtered)
    total_b_filtered = len(df_b_filtered)

    # Calculate match confidence safely
    match_confidence_avg = 0.0
    if len(matched_df) > 0 and 'confidence' in matched_df.columns:
        confidence_values = matched_df['confidence'].dropna()
        if len(confidence_values) > 0:
            match_confidence_avg = float(confidence_values.mean())

    return {
        "matched_records": matched_df,
        "unmatched_file_a": unmatched_a,
        "unmatched_file_b": unmatched_b,
        "match_statistics": {
            "total_file_a_original": total_a_original,
            "total_file_b_original": total_b_original,
            "total_file_a_after_filter": total_a_filtered,
            "total_file_b_after_filter": total_b_filtered,
            "matched_count": len(matched_df),
            "unmatched_file_a_count": len(unmatched_a),
            "unmatched_file_b_count": len(unmatched_b),
            "match_rate": len(matched_df) / max(total_a_filtered, total_b_filtered) * 100 if max(total_a_filtered,
                                                                                                 total_b_filtered) > 0 else 0,
            "match_confidence_avg": match_confidence_avg,
            "filter_impact_a": f"{total_a_original - total_a_filtered} records filtered out",
            "filter_impact_b": f"{total_b_original - total_b_filtered} records filtered out"
        }
    }


# Updated generate_summary_report with safe float handling
def generate_summary_report(result: Dict[str, Any]) -> str:
    """Generate a text summary report with safe float handling"""
    stats = result['match_statistics']

    report = f"""
RECONCILIATION SUMMARY REPORT
=============================
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

FILE STATISTICS:
- File A Original Records: {stats['total_file_a_original']}
- File B Original Records: {stats['total_file_b_original']}
- File A After Filter: {stats['total_file_a_after_filter']}
- File B After Filter: {stats['total_file_b_after_filter']}

MATCHING RESULTS:
- Matched Records: {stats['matched_count']}
- Unmatched in File A: {stats['unmatched_file_a_count']}
- Unmatched in File B: {stats['unmatched_file_b_count']}
- Match Rate: {safe_float(stats['match_rate']):.2f}%
- Average Match Confidence: {safe_float(stats.get('match_confidence_avg', 0)):.2f}

FILTER IMPACT:
- File A: {stats['filter_impact_a']}
- File B: {stats['filter_impact_b']}

APPLIED RULES:
"""

    for rule in result.get('applied_rules', []):
        report += f"- {rule['rule_type'].upper()}: {rule.get('description', 'No description')}\n"

    # Add amount differences if available
    if len(result['matched_records']) > 0 and 'amount_difference' in result['matched_records'].columns:
        amount_diffs = result['matched_records']['amount_difference'].dropna()
        if len(amount_diffs) > 0:
            report += f"\nAMOUNT DIFFERENCES:\n"
            report += f"- Total Matched with Amounts: {len(amount_diffs)}\n"
            report += f"- Average Difference: {safe_float(amount_diffs.mean()):,.2f}\n"
            report += f"- Max Difference: {safe_float(amount_diffs.max()):,.2f}\n"
            report += f"- Min Difference: {safe_float(amount_diffs.min()):,.2f}\n"
            report += f"- Total Absolute Difference: {safe_float(amount_diffs.abs().sum()):,.2f}\n"

    return report
