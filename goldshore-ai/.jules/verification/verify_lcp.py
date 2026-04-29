
from playwright.sync_api import sync_playwright

def verify_lcp_optimization():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the home page
        page.goto("http://localhost:4321/")

        # Verify that the header logo has the correct attributes
        logo = page.locator("header.gs-header a.gs-logo img")

        # Check for fetchpriority="high"
        # Note: fetchpriority is reflected as an attribute
        fetchpriority = logo.get_attribute("fetchpriority")
        assert fetchpriority == "high", f"Expected fetchpriority='high', but got '{fetchpriority}'"

        # Check for loading="eager"
        loading = logo.get_attribute("loading")
        assert loading == "eager", f"Expected loading='eager', but got '{loading}'"

        print("LCP Optimization Verified: fetchpriority='high' and loading='eager' are present on the header logo.")

        # Take a screenshot
        page.screenshot(path=".jules/verification/verification.png")

        browser.close()

if __name__ == "__main__":
    try:
        verify_lcp_optimization()
    except Exception as e:
        print(f"Verification failed: {e}")
        exit(1)
