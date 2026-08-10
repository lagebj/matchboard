# ZAP hook script for Matchboard
# Limits scanning scope and excludes external services.
# This is a placeholder - ZAP Python hooks require the full ZAP Python API.
# For baseline and active scans, the command-line scripts handle scope.

def zap_hook_options(options):
    """Configure ZAP scan options for Matchboard."""
    pass

def zap_hook_pre_scan(zap, target):
    """Set up ZAP context before scanning."""
    pass