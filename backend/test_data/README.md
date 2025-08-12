# Reconciliation Closest Match Test Files

## 📁 Files Included

### Test Data Files
- **`recon_test_file_a.csv`** - File A with 10 transaction records
- **`recon_test_file_b.csv`** - File B with 12 transaction records  
- Designed to test exact matches, near-matches, and unmatched scenarios

### Documentation  
- **`RECONCILIATION_CLOSEST_MATCH_TESTING.md`** - Complete step-by-step testing guide
- **`test_closest_match.py`** - Automated API test script
- **`README.md`** - This summary file

## 🚀 Quick Start

### 1. Manual Testing (Recommended)
Follow the comprehensive guide in `RECONCILIATION_CLOSEST_MATCH_TESTING.md` for:
- Frontend UI testing
- API testing
- Expected results analysis
- Troubleshooting tips

### 2. Automated Testing
```bash
# Ensure servers are running first:
# Backend: http://localhost:8000
# Frontend: http://localhost:5174

cd backend/test_data
python test_closest_match.py
```

## 🎯 What to Expect

### Without Closest Match:
- ~6 exact matches
- ~4 unmatched File A records  
- ~6 unmatched File B records
- Standard reconciliation columns only

### With Closest Match:
- Same match results as above
- **Plus 3 new columns** in unmatched records:
  - `closest_match_record` - Details of best match found
  - `closest_match_score` - Similarity score (0-100)
  - `closest_match_details` - Column-by-column breakdown

### Expected High-Score Matches:
- TXN002 ↔ REF002 (Jane Doe) - Score: ~98
- TXN007 ↔ EQP007 (Frank Miller) - Score: ~98  
- TXN008 ↔ CST008 (Grace Taylor) - Score: ~98
- TXN010 ↔ TRV010 (Ivy Rodriguez) - Score: ~98

## 🔧 Technical Implementation

### Composite Similarity Algorithms:
- **Text Matching**: Ratio + Partial + Token Sort + Token Set (rapidfuzz)
- **Numeric Matching**: Percentage difference calculation
- **Date Matching**: Day-based proximity scoring
- **Identifier Matching**: Strict similarity with partial matching

### API Parameters:
```json
{
  "find_closest_matches": true  // Enable closest match feature
}
```

### Performance:
- Small datasets (<100 records): <1 second
- Medium datasets (1000 records): <10 seconds
- Optimized for financial reconciliation scenarios

## 📊 Success Criteria

✅ API accepts `find_closest_matches` parameter  
✅ Closest match columns appear in unmatched results  
✅ Similarity scores are reasonable (>90 for near-matches)  
✅ Performance is acceptable for target dataset sizes  
✅ No errors in processing or API responses  

## 🐛 Troubleshooting

### Common Issues:
1. **"No closest matches found"** - Check if both files have unmatched records
2. **Low similarity scores** - Normal for genuinely different records  
3. **Missing columns** - Verify `find_closest_matches: true` in request
4. **Performance slow** - Reduce dataset size for testing

### Debug Tips:
- Check server console logs for processing messages
- Verify reconciliation rules match your column names
- Start with smaller datasets (5-10 records each)
- Test exact matches first, then enable closest matching

## 📞 Support

For issues or questions:
1. Check the comprehensive testing guide first
2. Review server logs for error messages
3. Test with smaller datasets to isolate issues
4. Verify API request format matches examples

---

**Ready to test?** Start with `RECONCILIATION_CLOSEST_MATCH_TESTING.md` for the complete walkthrough! 🎉