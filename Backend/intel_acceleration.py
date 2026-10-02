import os
import logging


logger = logging.getLogger(__name__)

HAS_IPEX = False
ipex = None

# IPEX is optional, and should not be loaded in CI unless explicitly enabled.
if os.getenv("DISABLE_IPEX", "").lower() not in {"1", "true", "yes", "on"}:
    try:
        import intel_extension_for_pytorch as ipex
        HAS_IPEX = True
    except Exception as exc:
        logger.warning("Intel Extension for PyTorch unavailable: %s", exc)

try:
    import openvino as ov
    HAS_OPENVINO = True
except ImportError:
    HAS_OPENVINO = False

try:
    from sklearnex import patch_sklearn
    HAS_SKLEARN_EX = True
except ImportError:
    HAS_SKLEARN_EX = False


def apply_intel_optimizations():
    """
    Apply Intel-specific optimizations across the AI lifecycle.
    """
    optimizations = []
    
    # 1. Patch Scikit-learn for Intel performance
    if HAS_SKLEARN_EX:
        patch_sklearn()
        optimizations.append("Intel Extension for Scikit-learn (patch applied)")
    
    # 2. Configure IPEX for PyTorch acceleration
    if HAS_IPEX:
        optimizations.append("Intel Extension for PyTorch (IPEX) detected")
        # Global IPEX settings if needed
    
    # 3. OpenVINO Inference Engine
    if HAS_OPENVINO:
        core = ov.Core()
        devices = core.available_devices
        optimizations.append(f"OpenVINO Runtime detected (Available devices: {', '.join(devices)})")

    if optimizations:
        logger.info("Intel AI Optimizations Active: " + " | ".join(optimizations))
    else:
        logger.warning("No Intel AI Optimizations found. Install 'intel-extension-for-pytorch', 'openvino', or 'scikit-learn-intelex'.")
    
    return optimizations

def get_openvino_device():
    """Returns the best available Intel device for OpenVINO inference."""
    if not HAS_OPENVINO:
        return "CPU"
    
    core = ov.Core()
    devices = core.available_devices
    if "GPU" in devices:
        return "GPU"  # Prefer Intel Integrated/Discrete Graphics
    return "CPU"

if __name__ == "__main__":
    # Test script to verify optimizations
    logging.basicConfig(level=logging.INFO)
    print("Checking for Intel AI Technologies...")
    opts = apply_intel_optimizations()
    for opt in opts:
        print(f"[SUCCESS] {opt}")




