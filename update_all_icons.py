
import re
import os

# Files to update
trails_file = r"c:\Users\Marco\SSD 2 TB (C)\Codici\Sitopdp\site\src\pages\info\montagna-sentieri.astro"
dropdown_file = r"c:\Users\Marco\SSD 2 TB (C)\Codici\Sitopdp\site\src\components\InfoDropdown.astro"
mobile_dropdown_file = r"c:\Users\Marco\SSD 2 TB (C)\Codici\Sitopdp\site\src\components\InfoDropdownMobile.astro"

# Mountain Icon Path (Terrain)
mountain_path = 'd="M14 6L10.25 11L13.1 14.8L11.5 16C9.81 13.75 7 10 7 10L1 18H23L14 6Z"'

# 1. Update montagna-sentieri.astro
with open(trails_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix TS Error
ts_fix_search = "const targetId = button.getAttribute('data-trail-details');"
ts_fix_replace = "const targetId = button.getAttribute('data-trail-details');\n          if (!targetId) return;"

if ts_fix_search in content and "if (!targetId) return;" not in content:
    content = content.replace(ts_fix_search, ts_fix_replace)
    print("Fixed TS error in trails file.")

# Replace Icons
# The previous replacement used:
# <svg class="w-6 h-6 text-{color}-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
#   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 19.5H3l5.618-13.109A1 1 0 019.537 6h4.926a1 1 0 01.919.609L21 19.5z" />
# </svg>

# Regex to match the svg block I inserted previously
# Note: I need to match the dynamic color parts
icon_regex = re.compile(
    r'<svg class="w-6 h-6 text-([a-z]+)-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">\s*'
    r'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="[^"]+" />\s*'
    r'</svg>',
    re.DOTALL
)

def icon_replacer(match):
    color = match.group(1)
    return f'<svg class="w-6 h-6 text-{color}-600" viewBox="0 0 24 24" fill="currentColor">\n                  <path d="{mountain_path}"/>\n                </svg>'

content_new, count = icon_regex.subn(icon_replacer, content)
print(f"Replaced {count} icons in trails file.")

with open(trails_file, 'w', encoding='utf-8') as f:
    f.write(content_new)


# 2. Update InfoDropdown.astro
with open(dropdown_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex for the specific icon in dropdown
# It has specific classes: text-gray-400 group-hover:text-primary-500 transition-colors duration-300
dropdown_icon_regex = re.compile(
    r'<svg class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">\s*'
    r'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>\s*'
    r'</svg>',
    re.DOTALL
)

dropdown_replacement = f'<svg class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">\n              <path d="{mountain_path}"/>\n            </svg>'

content_new, count = dropdown_icon_regex.subn(dropdown_replacement, content)
print(f"Replaced {count} icons in dropdown file.")

with open(dropdown_file, 'w', encoding='utf-8') as f:
    f.write(content_new)


# 3. Update InfoDropdownMobile.astro
with open(mobile_dropdown_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex for the specific icon in mobile dropdown
# It has specific classes: w-4 h-4
mobile_icon_regex = re.compile(
    r'<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\s*'
    r'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>\s*'
    r'</svg>',
    re.DOTALL
)

mobile_replacement = f'<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">\n              <path d="{mountain_path}"/>\n            </svg>'

content_new, count = mobile_icon_regex.subn(mobile_replacement, content)
print(f"Replaced {count} icons in mobile dropdown file.")

with open(mobile_dropdown_file, 'w', encoding='utf-8') as f:
    f.write(content_new)

