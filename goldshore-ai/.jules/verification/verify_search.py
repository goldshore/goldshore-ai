
from playwright.sync_api import sync_playwright, expect
import time

def verify_docs_search():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to docs page...")
        try:
            page.goto("http://localhost:4321/developer/docs", timeout=60000)
        except Exception as e:
            print(f"Failed to load page: {e}")
            browser.close()
            return

        print("Page loaded. Intercepting API requests...")

        # Mock the API response
        page.route("**/api/docs-search?q=test", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"title": "Test Documentation Page", "url": "/developer/docs/test-page", "excerpt": "This is a test result."}]'
        ))

        page.route("**/api/docs-search?q=empty", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[]'
        ))

        input_selector = '#docs-search-input'
        try:
            expect(page.locator(input_selector)).to_be_visible(timeout=10000)
            print("Search input found.")
        except Exception as e:
            print(f"Search input not found: {e}")
            page.screenshot(path=".jules/verification/failed_load.png")
            browser.close()
            return

        # 1. Test Search with Results
        print("Testing search with results...")
        page.fill(input_selector, "test")

        # In the new code, the results list is #results (not #docs-search-results)
        results_selector = '#results'

        # Wait for debounce (300ms) + fetch
        time.sleep(1)

        expect(page.locator(results_selector)).to_be_visible()
        expect(page.locator(input_selector)).to_have_attribute("aria-expanded", "true")

        expect(page.locator(f"{results_selector} li a")).to_contain_text("Test Documentation Page")

        print("Search results verified.")
        page.screenshot(path=".jules/verification/search_results.png")

        # 2. Test No Results
        print("Testing search with no results...")
        page.fill(input_selector, "empty")
        time.sleep(1)

        expect(page.locator(results_selector)).to_be_visible()
        expect(page.locator(f"{results_selector} li")).to_contain_text("No results found")
        # In the condensed code, I kept aria-expanded=true for no results (it shows the list with "No results")
        # Let's check the code logic:
        # if (data.length === 0) { list.innerHTML = '...'; } ...
        # Wait, if data.length === 0, I didn't set aria-expanded=false. I left it true because the list IS visible.
        # So I should expect "true" here actually, if the list is shown.
        expect(page.locator(input_selector)).to_have_attribute("aria-expanded", "true")

        print("No results state verified.")
        page.screenshot(path=".jules/verification/search_no_results.png")

        browser.close()
        print("Verification complete.")

if __name__ == "__main__":
    verify_docs_search()
