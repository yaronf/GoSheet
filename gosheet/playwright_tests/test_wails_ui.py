"""
Playwright UI tests for GoSheet Wails application.
Tests the frontend running in Vite dev mode.
"""
import pytest
from playwright.sync_api import Page, expect
import time


@pytest.fixture(scope="module")
def base_url():
    """Frontend dev server URL"""
    return "http://localhost:5174"


def test_page_loads(page: Page, base_url):
    """Test that the spreadsheet page loads"""
    page.goto(base_url)
    expect(page).to_have_title("GoSheet - Spreadsheet")
    
    # Check that the spreadsheet table exists
    table = page.locator('#spreadsheet')
    expect(table).to_be_visible()


def test_grid_structure(page: Page, base_url):
    """Test that the grid has correct structure"""
    page.goto(base_url)
    
    # Check column headers (A, B, C, etc.)
    header_a = page.locator('.column-header').first
    expect(header_a).to_have_text('A')
    
    # Check row headers (1, 2, 3, etc.)
    header_1 = page.locator('.row-header').first
    expect(header_1).to_have_text('1')
    
    # Check that data cells exist
    cell_a1 = page.locator('#cell-0-0')
    expect(cell_a1).to_be_visible()


def test_cell_selection(page: Page, base_url):
    """Test that clicking a cell selects it"""
    page.goto(base_url)
    time.sleep(0.5)  # Wait for initialization
    
    cell = page.locator('#cell-0-0')
    cell.click()
    
    # Cell should have 'selected' class
    expect(cell).to_have_class(/selected/)


def test_enter_single_digit(page: Page, base_url):
    """Test entering a single digit"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Click cell and type
    cell = page.locator('#cell-1-1')
    cell.click()
    page.keyboard.type('5')
    page.keyboard.press('Enter')
    
    time.sleep(0.3)  # Wait for save
    
    # Cell should display the value
    expect(cell).to_have_text('5')


def test_enter_multi_digit_number(page: Page, base_url):
    """Test entering a multi-digit number"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Click cell and type multi-digit number
    cell = page.locator('#cell-2-2')
    cell.click()
    page.keyboard.type('123')
    page.keyboard.press('Enter')
    
    time.sleep(0.3)
    
    # Cell should display the full number
    expect(cell).to_have_text('123')


def test_enter_multiple_values(page: Page, base_url):
    """Test entering values in multiple cells"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter value in first cell
    cell1 = page.locator('#cell-3-0')
    cell1.click()
    page.keyboard.type('10')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Enter value in second cell
    cell2 = page.locator('#cell-4-0')
    cell2.click()
    page.keyboard.type('20')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Enter value in third cell
    cell3 = page.locator('#cell-5-0')
    cell3.click()
    page.keyboard.type('30')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Verify all values
    expect(cell1).to_have_text('10')
    expect(cell2).to_have_text('20')
    expect(cell3).to_have_text('30')


def test_edit_existing_cell(page: Page, base_url):
    """Test editing a cell that already has a value"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter initial value
    cell = page.locator('#cell-6-0')
    cell.click()
    page.keyboard.type('100')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Edit the cell
    cell.click()
    page.keyboard.type('200')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Should have new value
    expect(cell).to_have_text('200')


def test_escape_cancels_edit(page: Page, base_url):
    """Test that Escape key cancels editing"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter initial value
    cell = page.locator('#cell-7-0')
    cell.click()
    page.keyboard.type('50')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Start editing and cancel
    cell.click()
    page.keyboard.type('999')
    page.keyboard.press('Escape')
    time.sleep(0.2)
    
    # Should still have original value
    expect(cell).to_have_text('50')


def test_formula_entry(page: Page, base_url):
    """Test entering a simple formula"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter a formula
    cell = page.locator('#cell-8-0')
    cell.click()
    page.keyboard.type('=5+3')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Should display computed result
    expect(cell).to_have_text('8')
    
    # Should have formula-cell class
    expect(cell).to_have_class(/formula-cell/)


def test_edit_after_formula(page: Page, base_url):
    """Test that we can edit cells after entering a formula"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter a formula
    cell1 = page.locator('#cell-9-0')
    cell1.click()
    page.keyboard.type('=2*3')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Enter a regular value in next cell
    cell2 = page.locator('#cell-10-0')
    cell2.click()
    page.keyboard.type('42')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Verify both cells
    expect(cell1).to_have_text('6')
    expect(cell2).to_have_text('42')


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
