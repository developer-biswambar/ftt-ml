# backend/app/routes/rule_management_routes.py
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.utils.uuid_generator import generate_uuid

# Setup logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/rules", tags=["rule_management"])

# In-memory storage for rules (in production, use a proper database)
rules_storage = {}


class RuleMetadata(BaseModel):
    """Metadata for a saved rule"""
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "general"
    tags: Optional[List[str]] = []
    template_id: Optional[str] = None
    template_name: Optional[str] = None


class SavedReconciliationRule(BaseModel):
    """Complete saved reconciliation rule"""
    id: str
    name: str
    description: Optional[str] = ""
    category: str = "general"
    tags: List[str] = []
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    created_at: str
    updated_at: str
    version: str = "1.0"

    # Core rule configuration (without file-specific data)
    rule_config: Dict[str, Any]

    # Usage statistics
    usage_count: int = 0
    last_used_at: Optional[str] = None


class CreateRuleRequest(BaseModel):
    """Request to create a new rule"""
    metadata: RuleMetadata
    rule_config: Dict[str, Any]


class UpdateRuleRequest(BaseModel):
    """Request to update an existing rule"""
    metadata: Optional[RuleMetadata] = None
    rule_config: Optional[Dict[str, Any]] = None


class RuleSearchFilters(BaseModel):
    """Filters for searching rules"""
    category: Optional[str] = None
    template_id: Optional[str] = None
    tags: Optional[List[str]] = []
    name_contains: Optional[str] = None


def sanitize_rule_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Remove file-specific references from rule config to make it reusable"""
    sanitized = {}

    # Process Files configuration - remove file-specific names but keep structure
    if 'Files' in config:
        sanitized['Files'] = []
        for i, file_config in enumerate(config['Files']):
            sanitized_file = {
                'Name': f'File{chr(65 + i)}',  # FileA, FileB, etc.
                'Extract': file_config.get('Extract', []),
                'Filter': file_config.get('Filter', [])
            }
            # Remove any file-specific sheet names
            if 'SheetName' in file_config:
                sanitized_file['SheetName'] = None
            sanitized['Files'].append(sanitized_file)

    # Keep reconciliation rules as-is (they reference logical column names)
    if 'ReconciliationRules' in config:
        sanitized['ReconciliationRules'] = config['ReconciliationRules']

    # Remove specific column selections - these will be reconfigured for new files
    # We'll store them as examples but not apply them directly
    if 'selected_columns_file_a' in config:
        sanitized['example_columns_file_a'] = config['selected_columns_file_a']
    if 'selected_columns_file_b' in config:
        sanitized['example_columns_file_b'] = config['selected_columns_file_b']

    # Keep user requirements as reference
    if 'user_requirements' in config:
        sanitized['user_requirements'] = config['user_requirements']

    return sanitized


def apply_rule_to_files(rule_config: Dict[str, Any], file_columns: Dict[str, List[str]]) -> Dict[str, Any]:
    """Apply a saved rule to new files, adapting to their column structure"""
    applied_config = rule_config.copy()

    # The Files structure can be applied as-is since it doesn't contain file-specific data
    # Column selections will be handled in the frontend based on available columns

    return applied_config


@router.post("/save", response_model=SavedReconciliationRule)
async def save_rule(request: CreateRuleRequest):
    """Save a new reconciliation rule"""
    try:
        rule_id = generate_uuid('rule')
        timestamp = datetime.now().isoformat()

        # Sanitize the rule config to remove file-specific references
        sanitized_config = sanitize_rule_config(request.rule_config)

        saved_rule = SavedReconciliationRule(
            id=rule_id,
            name=request.metadata.name,
            description=request.metadata.description or "",
            category=request.metadata.category or "general",
            tags=request.metadata.tags or [],
            template_id=request.metadata.template_id,
            template_name=request.metadata.template_name,
            created_at=timestamp,
            updated_at=timestamp,
            rule_config=sanitized_config,
            usage_count=0
        )

        rules_storage[rule_id] = saved_rule.dict()

        logger.info(f"Saved new rule: {rule_id} - {request.metadata.name}")
        return saved_rule

    except Exception as e:
        logger.error(f"Error saving rule: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rule: {str(e)}")


@router.get("/list", response_model=List[SavedReconciliationRule])
async def list_rules(
        category: Optional[str] = Query(None, description="Filter by category"),
        template_id: Optional[str] = Query(None, description="Filter by template ID"),
        limit: int = Query(50, description="Maximum number of rules to return"),
        offset: int = Query(0, description="Number of rules to skip")
):
    """List saved reconciliation rules with optional filtering"""
    try:
        all_rules = list(rules_storage.values())

        # Apply filters
        filtered_rules = all_rules

        if category:
            filtered_rules = [r for r in filtered_rules if r.get('category') == category]

        if template_id:
            filtered_rules = [r for r in filtered_rules if r.get('template_id') == template_id]

        # Sort by last updated (most recent first)
        filtered_rules.sort(key=lambda x: x.get('updated_at', ''), reverse=True)

        # Apply pagination
        paginated_rules = filtered_rules[offset:offset + limit]

        # Convert to Pydantic models
        result = [SavedReconciliationRule(**rule) for rule in paginated_rules]

        return result

    except Exception as e:
        logger.error(f"Error listing rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")


@router.get("/template/{template_id}", response_model=List[SavedReconciliationRule])
async def get_rules_by_template(template_id: str):
    """Get all rules for a specific template"""
    try:
        template_rules = [
            SavedReconciliationRule(**rule)
            for rule in rules_storage.values()
            if rule.get('template_id') == template_id
        ]

        # Sort by usage count and last used
        template_rules.sort(
            key=lambda x: (x.usage_count, x.last_used_at or ''),
            reverse=True
        )

        return template_rules

    except Exception as e:
        logger.error(f"Error getting rules for template {template_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get template rules: {str(e)}")


@router.get("/{rule_id}", response_model=SavedReconciliationRule)
async def get_rule(rule_id: str):
    """Get a specific rule by ID"""
    if rule_id not in rules_storage:
        raise HTTPException(status_code=404, detail="Rule not found")

    try:
        rule_data = rules_storage[rule_id]
        return SavedReconciliationRule(**rule_data)

    except Exception as e:
        logger.error(f"Error getting rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get rule: {str(e)}")


@router.put("/{rule_id}", response_model=SavedReconciliationRule)
async def update_rule(rule_id: str, request: UpdateRuleRequest):
    """Update an existing rule"""
    if rule_id not in rules_storage:
        raise HTTPException(status_code=404, detail="Rule not found")

    try:
        rule_data = rules_storage[rule_id].copy()

        # Update metadata if provided
        if request.metadata:
            if request.metadata.name:
                rule_data['name'] = request.metadata.name
            if request.metadata.description is not None:
                rule_data['description'] = request.metadata.description
            if request.metadata.category:
                rule_data['category'] = request.metadata.category
            if request.metadata.tags is not None:
                rule_data['tags'] = request.metadata.tags

        # Update rule config if provided
        if request.rule_config:
            sanitized_config = sanitize_rule_config(request.rule_config)
            rule_data['rule_config'] = sanitized_config

        # Update timestamp
        rule_data['updated_at'] = datetime.now().isoformat()

        # Save updated rule
        rules_storage[rule_id] = rule_data

        logger.info(f"Updated rule: {rule_id}")
        return SavedReconciliationRule(**rule_data)

    except Exception as e:
        logger.error(f"Error updating rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")


@router.post("/{rule_id}/use")
async def mark_rule_as_used(rule_id: str):
    """Mark a rule as used (for analytics)"""
    if rule_id not in rules_storage:
        raise HTTPException(status_code=404, detail="Rule not found")

    try:
        rule_data = rules_storage[rule_id]
        rule_data['usage_count'] = rule_data.get('usage_count', 0) + 1
        rule_data['last_used_at'] = datetime.now().isoformat()

        rules_storage[rule_id] = rule_data

        return {"success": True, "usage_count": rule_data['usage_count']}

    except Exception as e:
        logger.error(f"Error marking rule {rule_id} as used: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update rule usage: {str(e)}")


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a rule"""
    if rule_id not in rules_storage:
        raise HTTPException(status_code=404, detail="Rule not found")

    try:
        deleted_rule = rules_storage.pop(rule_id)
        logger.info(f"Deleted rule: {rule_id} - {deleted_rule.get('name')}")

        return {"success": True, "message": f"Rule '{deleted_rule.get('name')}' deleted successfully"}

    except Exception as e:
        logger.error(f"Error deleting rule {rule_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete rule: {str(e)}")


@router.post("/search", response_model=List[SavedReconciliationRule])
async def search_rules(filters: RuleSearchFilters):
    """Search rules with advanced filters"""
    try:
        all_rules = list(rules_storage.values())
        filtered_rules = all_rules

        # Apply filters
        if filters.category:
            filtered_rules = [r for r in filtered_rules if r.get('category') == filters.category]

        if filters.template_id:
            filtered_rules = [r for r in filtered_rules if r.get('template_id') == filters.template_id]

        if filters.tags:
            filtered_rules = [
                r for r in filtered_rules
                if any(tag in r.get('tags', []) for tag in filters.tags)
            ]

        if filters.name_contains:
            search_term = filters.name_contains.lower()
            filtered_rules = [
                r for r in filtered_rules
                if search_term in r.get('name', '').lower() or
                   search_term in r.get('description', '').lower()
            ]

        # Sort by relevance (usage count and last used)
        filtered_rules.sort(
            key=lambda x: (x.get('usage_count', 0), x.get('last_used_at', '')),
            reverse=True
        )

        # Convert to Pydantic models
        result = [SavedReconciliationRule(**rule) for rule in filtered_rules]

        return result

    except Exception as e:
        logger.error(f"Error searching rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search rules: {str(e)}")


@router.get("/categories/list")
async def list_categories():
    """Get all available rule categories"""
    try:
        categories = list(set(rule.get('category', 'general') for rule in rules_storage.values()))
        categories.sort()

        return {
            "categories": categories,
            "default_categories": [
                "general",
                "financial",
                "trading",
                "reconciliation",
                "validation",
                "custom"
            ]
        }

    except Exception as e:
        logger.error(f"Error listing categories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list categories: {str(e)}")


@router.get("/health")
async def rule_management_health():
    """Health check for rule management service"""
    try:
        total_rules = len(rules_storage)
        categories = list(set(rule.get('category', 'general') for rule in rules_storage.values()))

        # Calculate some basic statistics
        total_usage = sum(rule.get('usage_count', 0) for rule in rules_storage.values())

        return {
            "status": "healthy",
            "service": "rule_management",
            "total_rules": total_rules,
            "total_categories": len(categories),
            "total_usage": total_usage,
            "storage_type": "in_memory",
            "features": [
                "save_rules",
                "load_rules",
                "search_rules",
                "template_based",
                "usage_tracking",
                "rule_versioning"
            ]
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")