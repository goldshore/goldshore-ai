from playwright.sync_api import Page, expect, sync_playwright
import os

def verify_hero(page: Page):
    page.goto("http://localhost:4321")
    page.wait_for_timeout(2000) # Wait for animations and WebGL

    # Check for the new headline
    expect(page.get_by_text("Shaping Waves with Applied Intelligence")).to_be_visible()

    # Check for the status pill
    expect(page.get_by_text("SYSTEM OPERATIONAL")).to_be_visible()

    # Check for the buttons
    expect(page.get_by_role("link", name="Start the Experience")).to_be_visible()
    expect(page.get_by_role("link", name="Contact Sales")).to_be_visible()

    # Take a screenshot
    os.makedirs("/app/verification", exist_ok=True)
    page.screenshot(path="/app/verification/hero_verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        os.makedirs("/app/verification/video", exist_ok=True)
        context = browser.new_context(record_video_dir="/app/verification/video")
        page = context.new_page()
        try:
            verify_hero(page)
        finally:
            context.close()
            browser.close()
