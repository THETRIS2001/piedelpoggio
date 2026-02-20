import re

path = r"c:\Users\Marco\SSD 2 TB (C)\Codici\Sitopdp\site\src\pages\info\montagna-sentieri.astro"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find: class="bg-gradient-to-br from-ColorA to-ColorB rounded-xl p-6 hover:shadow-lg transition-all duration-300 flex flex-col"
# Replace with: class="bg-gradient-to-br from-ColorA to-ColorB backdrop-blur-sm shadow-xl border border-gray-200 hover:shadow-2xl rounded-xl p-6 transition-all duration-300 flex flex-col"
pattern = re.compile(r'class="bg-gradient-to-br from-([a-z]+-50) to-([a-z]+-50) rounded-xl p-6 hover:shadow-lg transition-all duration-300 flex flex-col"')
replacement = r'class="bg-gradient-to-br from-\1 to-\2 backdrop-blur-sm shadow-xl border border-gray-200 hover:shadow-2xl rounded-xl p-6 transition-all duration-300 flex flex-col"'

new_content = pattern.sub(replacement, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print(f"Replaced {len(pattern.findall(content))} occurrences.")
