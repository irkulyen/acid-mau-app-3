#!/usr/bin/env python3
"""Replace all TouchableOpacity with Touchable in app files."""
import re
import os

FILES = [
    "app/(tabs)/profile.tsx",
    "app/auth/onboarding.tsx",
    "app/dev/theme-lab.tsx",
    "app/game/play.tsx",
    "app/lobby/create.tsx",
    "app/lobby/join.tsx",
    "app/results/game-summary.tsx",
]

BASE = "/home/ubuntu/crazyamsel-app"

for f in FILES:
    path = os.path.join(BASE, f)
    if not os.path.exists(path):
        print(f"SKIP (not found): {f}")
        continue
    
    with open(path, "r") as fh:
        content = fh.read()
    
    original = content
    
    # 1. Replace <TouchableOpacity with <Touchable
    content = content.replace("<TouchableOpacity", "<Touchable")
    content = content.replace("</TouchableOpacity>", "</Touchable>")
    
    # 2. Remove TouchableOpacity from react-native import
    # Match: TouchableOpacity, or , TouchableOpacity or TouchableOpacity,
    content = re.sub(r',\s*TouchableOpacity', '', content)
    content = re.sub(r'TouchableOpacity\s*,\s*', '', content)
    content = re.sub(r'TouchableOpacity', '', content)  # standalone (shouldn't happen)
    
    # 3. Add Touchable import if not already present
    if 'import { Touchable }' not in content and "from \"@/components/ui/button\"" not in content:
        # Add after the first import line
        content = content.replace(
            'import {',
            'import { Touchable } from "@/components/ui/button";\nimport {',
            1
        )
    
    if content != original:
        with open(path, "w") as fh:
            fh.write(content)
        print(f"FIXED: {f}")
    else:
        print(f"NO CHANGE: {f}")
