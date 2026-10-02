from Backend.functions.shared_utils import to_object_id, clean_json_text
from bson import ObjectId

def test_to_object_id_valid():
    valid_id = "507f1f77bcf86cd799439011"
    obj_id = to_object_id(valid_id)
    assert isinstance(obj_id, ObjectId)
    assert str(obj_id) == valid_id

def test_to_object_id_invalid():
    assert to_object_id("invalid-id") is None
    assert to_object_id(None) is None

def test_clean_json_text():
    raw = "`json\n{\"key\": \"value\"}\n`"
    cleaned = clean_json_text(raw)
    assert cleaned == "{\"key\": \"value\"}"
