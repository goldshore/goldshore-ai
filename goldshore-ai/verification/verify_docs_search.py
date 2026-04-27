from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        # Listen for console logs
        context.on("page", lambda page: page.on("console", lambda msg: print(f"CONSOLE: {msg.text}")))
        page = context.new_page()

        try:
            print("Navigating to http://localhost:4321/developer/docs")
            page.goto("http://localhost:4321/developer/docs", timeout=30000)

            print("Waiting for search input...")
            search_input = page.locator("#docs-search-input")
            search_input.wait_for(state="visible", timeout=10000)

            print("Checking for shortcut hint...")
            shortcut_hint = page.locator(".search-shortcut")
            expect(shortcut_hint).to_be_visible()

            print("Testing keyboard interaction...")
            # Focus body first
            page.locator("body").click()

            # Explicitly press Control+K
            print("Pressing Control+K...")
            page.keyboard.press("Control+K")

            # Short wait
            page.wait_for_timeout(500)

            is_focused = search_input.evaluate("el => document.activeElement === el")
            print(f"Is focused (Control+K): {is_focused}")

            if not is_focused:
                 print("Pressing Meta+K...")
                 page.keyboard.press("Meta+K")
                 page.wait_for_timeout(500)
                 is_focused = search_input.evaluate("el => document.activeElement === el")
                 print(f"Is focused (Meta+K): {is_focused}")

            if is_focused:
                 print("Focus verified!")
            else:
                 print("Focus failed.")

            print("Taking screenshot...")
            # Take screenshot of the whole page to see context
            page.screenshot(path="verification/docs_search_full.png")
            # And component
            page.locator(".search-box").screenshot(path="verification/docs_search.png")

        except Exception as e:
            print(f"Verification failed: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
