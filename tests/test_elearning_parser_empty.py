import pytest

from app.modules.elearning import parse_courses


def test_parse_courses_rejects_empty_upstream_page_instead_of_caching_false_empty():
    with pytest.raises(ValueError, match="HTML_STRUCTURE_CHANGED"):
        parse_courses("<html><body><h1>Login</h1></body></html>")
