import traceback

try:
    import main
    print("IMPORT_OK")
except Exception:
    traceback.print_exc()
    print("IMPORT_FAILED")
