# Bolt's Journal

## 2024-05-22 - [Race Condition in Search]
**Learning:** `DocsSearch.astro` had a race condition where fast typing could lead to older search results overwriting newer ones because requests weren't cancelled.
**Action:** Always use `AbortController` when implementing search-as-you-type or any debounced async operation to ensure the UI reflects the latest state.
