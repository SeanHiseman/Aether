-- Diagnostic Script for saved_posts Table
-- Run this to see your current table structure and constraints

SELECT '=' AS '', '========================================' AS '';
SELECT '=' AS '', 'SAVED_POSTS TABLE DIAGNOSTICS' AS '';
SELECT '=' AS '', '========================================' AS '';

-- Show current table structure
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '1. CURRENT TABLE STRUCTURE:' AS '';
SELECT '=' AS '', '----------------------------' AS '';
SHOW CREATE TABLE saved_posts\G

-- Show all constraints
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '2. FOREIGN KEY CONSTRAINTS:' AS '';
SELECT '=' AS '', '----------------------------' AS '';
SELECT
    CONSTRAINT_NAME as 'Constraint Name',
    COLUMN_NAME as 'Column',
    REFERENCED_TABLE_NAME as 'References Table',
    REFERENCED_COLUMN_NAME as 'References Column'
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'saved_posts'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Show current primary key
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '3. PRIMARY KEY:' AS '';
SELECT '=' AS '', '---------------' AS '';
SELECT
    COLUMN_NAME as 'Column',
    ORDINAL_POSITION as 'Position in PK'
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'saved_posts'
AND CONSTRAINT_NAME = 'PRIMARY'
ORDER BY ORDINAL_POSITION;

-- Show all indexes
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '4. INDEXES:' AS '';
SELECT '=' AS '', '-----------' AS '';
SELECT DISTINCT
    INDEX_NAME as 'Index Name',
    COLUMN_NAME as 'Column',
    NON_UNIQUE as 'Non-Unique'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'saved_posts'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check if saved_post_channels exists
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '5. SAVED_POST_CHANNELS TABLE CHECK:' AS '';
SELECT '=' AS '', '-----------------------------------' AS '';
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN 'EXISTS - OK to proceed with migration'
        ELSE 'DOES NOT EXIST - Create it first!'
    END as 'Status'
FROM information_schema.tables
WHERE table_schema = DATABASE()
AND table_name = 'saved_post_channels';

-- Show sample data
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '6. SAMPLE DATA (first 5 rows):' AS '';
SELECT '=' AS '', '------------------------------' AS '';
SELECT * FROM saved_posts LIMIT 5;

-- Count total rows
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '7. TOTAL ROWS:' AS '';
SELECT '=' AS '', '--------------' AS '';
SELECT COUNT(*) as 'Total Saved Posts' FROM saved_posts;

SELECT '=' AS '', '' AS '';
SELECT '=' AS '', '========================================' AS '';
SELECT '=' AS '', 'DIAGNOSTICS COMPLETE' AS '';
SELECT '=' AS '', '========================================' AS '';

-- Generate DROP statements for existing foreign keys
SELECT '=' AS '', '' AS '';
SELECT '=' AS '', 'COPY THESE COMMANDS TO DROP FOREIGN KEYS:' AS '';
SELECT '=' AS '', '==========================================' AS '';
SELECT CONCAT('ALTER TABLE saved_posts DROP FOREIGN KEY ', CONSTRAINT_NAME, ';') as 'Commands'
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'saved_posts'
AND REFERENCED_TABLE_NAME IS NOT NULL;
