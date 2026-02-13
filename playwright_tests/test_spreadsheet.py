"""
Playwright UI tests for GoSheet web application.
Tests the frontend running against the Go HTTP backend.
"""
import pytest
from playwright.sync_api import Page, expect
import time


@pytest.fixture(scope="session")
def base_url():
    """Backend server URL"""
    return "http://localhost:3000"


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


def test_sample_data_loaded(page: Page, base_url):
    """Test that sample data is loaded"""
    page.goto(base_url)
    time.sleep(0.5)  # Wait for data to load
    
    # Check sample data
    expect(page.locator('#cell-0-0')).to_have_text('10')
    expect(page.locator('#cell-1-0')).to_have_text('20')
    expect(page.locator('#cell-2-0')).to_have_text('30')
    expect(page.locator('#cell-3-0')).to_have_text('60')  # SUM formula result
    expect(page.locator('#cell-0-1')).to_have_text('20')  # A1*2 formula result


def test_cell_selection(page: Page, base_url):
    """Test that clicking a cell selects it"""
    page.goto(base_url)
    time.sleep(0.5)
    
    cell = page.locator('#cell-5-5')
    cell.click()
    
    # Cell should have 'selected' class (among others like 'cell')
    class_attr = cell.get_attribute('class')
    assert 'selected' in class_attr


def test_enter_single_digit(page: Page, base_url):
    """Test entering a single digit"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Click cell and type
    cell = page.locator('#cell-10-0')
    cell.click()
    page.keyboard.type('5')
    page.keyboard.press('Enter')
    
    time.sleep(0.3)  # Wait for save
    
    # Cell should display the value
    expect(cell).to_have_text('5')


def test_enter_multi_digit_number(page: Page, base_url):
    """Test entering a multi-digit number - THIS IS THE BUG WE'RE TRACKING"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Click cell and type multi-digit number
    cell = page.locator('#cell-11-0')
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
    cell1 = page.locator('#cell-12-0')
    cell1.click()
    page.keyboard.type('10')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Enter value in second cell
    cell2 = page.locator('#cell-13-0')
    cell2.click()
    page.keyboard.type('20')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Enter value in third cell
    cell3 = page.locator('#cell-14-0')
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
    cell = page.locator('#cell-15-0')
    cell.click()
    page.keyboard.type('100')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Edit the cell (double-click to edit)
    cell.dblclick()
    time.sleep(0.1)
    # Clear and type new value
    page.keyboard.press('Control+a')
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
    cell = page.locator('#cell-16-0')
    cell.click()
    page.keyboard.type('50')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Start editing and cancel
    cell.dblclick()
    time.sleep(0.1)
    page.keyboard.type('999')
    page.keyboard.press('Escape')
    time.sleep(0.2)
    
    # Should still have original value
    expect(cell).to_have_text('50')


def test_simple_formula(page: Page, base_url):
    """Test entering a simple formula"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter a formula
    cell = page.locator('#cell-17-0')
    cell.click()
    page.keyboard.type('=5+3')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Should display computed result
    expect(cell).to_have_text('8')
    
    # Should have formula-cell class
    assert 'formula-cell' in cell.get_attribute('class')


def test_edit_after_formula(page: Page, base_url):
    """Test that we can edit cells after entering a formula"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter a formula
    cell1 = page.locator('#cell-18-0')
    cell1.click()
    page.keyboard.type('=2*3')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Enter a regular value in next cell
    cell2 = page.locator('#cell-19-0')
    cell2.click()
    page.keyboard.type('42')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Verify both cells
    expect(cell1).to_have_text('6')
    expect(cell2).to_have_text('42')


def test_cell_reference_formula(page: Page, base_url):
    """Test formula with cell references"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Enter values in two cells
    cell1 = page.locator('#cell-20-0')
    cell1.click()
    page.keyboard.type('5')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    cell2 = page.locator('#cell-21-0')
    cell2.click()
    page.keyboard.type('3')
    page.keyboard.press('Enter')
    time.sleep(0.2)
    
    # Enter formula referencing those cells
    cell3 = page.locator('#cell-22-0')
    cell3.click()
    page.keyboard.type('=A21+A22')
    page.keyboard.press('Enter')
    time.sleep(0.3)
    
    # Should display sum
    expect(cell3).to_have_text('8')


def test_arrow_key_navigation(page: Page, base_url):
    """Test navigating with arrow keys"""
    page.goto(base_url)
    time.sleep(0.5)
    
    # Select a cell
    cell = page.locator('#cell-5-5')
    cell.click()
    assert 'selected' in cell.get_attribute('class')
    
    # Navigate down
    page.keyboard.press('ArrowDown')
    time.sleep(0.1)
    cell_below = page.locator('#cell-6-5')
    assert 'selected' in cell_below.get_attribute('class')
    
    # Navigate right
    page.keyboard.press('ArrowRight')
    time.sleep(0.1)
    cell_right = page.locator('#cell-6-6')
    assert 'selected' in cell_right.get_attribute('class')


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
