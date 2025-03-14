#!/usr/bin/env python3
"""
Dan's static site generator

This is my first attempt at a PEP 8-compilant python script that I can be
proud of. It is and will always be designed for personal use but can easily be
borrowed by replacing the contents of the 'source' folder.

TODO: compress images
TODO: turn written links into hyperlinks automatically
TODO: gitpython integration for tracking which pages need to be (re)generated
TODO: gitpython integration for pushing to github pages
TODO: autogenerating links to internal pages
TODO: Fix cwd to always be based off of this file
"""
import imghdr
import os
import shutil
import re
import requests

from markdown_it import MarkdownIt
from pathlib import Path
from PIL import Image

# maximum pixel size for images
MAX_IMAGE_WIDTH = 1200
MAX_IMAGE_HEIGHT = 900

md = (
    MarkdownIt()
    .enable('image')
    .enable('table')
)

class SitePage:
    """
    SitePage class that is instantiated for each file in the source dir.

    HTML files will be mirrored in the same directory structure with the
    same name as their source markdown files.
    """
    def __init__(self, path):
        self.path = path
        self.text = path.open('r').read()
        self.head = open('./components/head.html', 'r').read()
        self.header = open('./components/header.html', 'r').read()
        self.foot = open('./components/footer.html', 'r').read()
        self.webrings = open('./components/webrings.html', 'r').read()
        #temporary path transormations to help create mirrored html file
        self.p    = path.relative_to('source').with_suffix('.html')
        self.out  = Path('site').joinpath(self.p)
        self.html = self.personalize(md.render(self.text))


    def add_site_sources(self, html_doc):
        """
        Adds CSS
        """
        css = '<link rel="stylesheet" href="/css/site.css">\n'
        return css + html_doc

    def add_highlight_js_tags(self, html_doc):
        """
        Adds syntax highlighting
        """
        link_tag = '<link rel="stylesheet" href="/css/highlight.css">\n'
        script_tag = '<script src="/js/highlight.min.js"></script>\n'
        run_tag = '<script>hljs.highlightAll();</script>\n'
        return link_tag + script_tag + run_tag + html_doc

    def add_header_and_footer(self, html_doc):
        """
        Adds the header and footer to each page
        """
        if self.path == Path('source/index.md'):
            out = self.header + html_doc
        else:
            out = self.header + html_doc + self.foot
        return out + self.webrings

    def add_head(self, html_doc):
        """
        Adds html <head> tag with metadata
        """
        title = 'mayer.cool'
        match = re.search('<h1>(.*?)</h1>', html_doc)
        if match:
            title = match.group(1)
        head = self.head.replace('{title}', title)
        head = head.replace('{path}', str(self.p))
        return head + html_doc


    def personalize(self, html_doc):
        """
        Adds all the website-specific extra html
        """
        out = self.add_header_and_footer(html_doc)
        out = self.add_site_sources(out)
        if "<code" in out:
            out = self.add_highlight_js_tags(out)
        if "[[" in out:
            out = self.replace_card_names_with_images(out)
        out = self.add_head(out)
        return out

    def export(self):
        """
        Writes generated markdown to its mirrored location within the
        'site' directory.
        """
        self.out.parent.mkdir(exist_ok=True, parents=True)
        self.out.write_text(self.html)

    def download_scryfall_image(self, card_name):
        """
        Downloads card image from Scryfall API and saves it locally.
        Returns the relative path to use in HTML.
        """
        # Determine directory to save images - same as markdown file
        image_dir = os.path.dirname(self.path)
        # Create safe filename from card name
        safe_name = re.sub(r'[^a-zA-Z0-9]', '_', card_name.lower())
        image_filename = f"scryfall_{safe_name}.jpg"
        image_path = os.path.join(image_dir, image_filename)
        
        # If image already exists, use it
        if os.path.exists(image_path):
            # Process with copy_image to ensure it's in the site directory
            copy_image(Path(image_path))
            # Return path relative to source for HTML
            rel_path = os.path.relpath(image_path, 'source')
            return f"/{rel_path}"
        
        # Scryfall API to get card info
        base_url = "https://api.scryfall.com/cards/named"
        params = {'fuzzy': card_name}
        response = requests.get(base_url, params=params)

        if response.status_code == 200:
            data = response.json()
            image_url = data['image_uris']['normal']
            
            # Download the image
            img_response = requests.get(image_url, stream=True)
            if img_response.status_code == 200:
                os.makedirs(os.path.dirname(image_path), exist_ok=True)
                with open(image_path, 'wb') as img_file:
                    for chunk in img_response.iter_content(1024):
                        img_file.write(chunk)
                        
                # Process with copy_image to ensure it's properly sized and copied to site directory
                copy_image(Path(image_path))
                
                # Return path relative to source for HTML
                rel_path = os.path.relpath(image_path, 'source')
                return f"/{rel_path}"
        
        print(f"Error fetching card data for {card_name}")
        return None

    def replace_card_names_with_images(self, input_text):
        """
        Replace card names with local images.
        """
        # Regular expression to find card names enclosed in double brackets
        card_pattern = r'\[\[([^\]]+)\]\]'
        
        def replace_card(match):
            card_name = match.group(1)
            image_path = self.download_scryfall_image(card_name)
            
            if image_path:
                # Create HTML image tag with local path
                return f'<img src="{image_path}" class="card-image" alt="{card_name}">'
            else:
                return match.group(0)

        # Find all instances of card clumps
        clump_pattern = r'(\[\[[^\]]+\]\](?:\s*\[\[[^\]]+\]\])*)'
        
        def wrap_in_div(clump_match):
            clump = clump_match.group(1)
            card_count = len(re.findall(card_pattern, clump))
            clump_with_images = re.sub(card_pattern, replace_card, clump)
            return f'<div class="card-container" style="--card-count: {card_count};">{clump_with_images}</div>'
        
        # Replace clumps with styled containers
        result = re.sub(clump_pattern, wrap_in_div, input_text)
        return result

def copy_file(path):
    """
    Helper method to move over everything that isn't an image, since those have
    to be compressed
    """
    p = path.relative_to('source')
    # ensure extension is lowercase because github.io doesn't track it
    dest = Path('site').joinpath(p)
    file_extension = dest.suffix
    lowercase_extension = file_extension.lower()
    dest = dest.with_suffix(lowercase_extension)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy(path, dest)

def copy_image(path):
    """
    Image compression helper. Compresses images of arbitrary format while ensuring
    they do not exceed the specified max width and max height.
    """
    # Compress images of arbitrary format
    p = path.relative_to('source')
    # Ensure extension is lowercase because GitHub.io doesn't track it
    dest = Path('site').joinpath(p)
    file_extension = dest.suffix
    lowercase_extension = file_extension.lower()
    dest = dest.with_suffix(lowercase_extension)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    
    # Open the image
    image = Image.open(path)
    width, height = image.size
    aspectratio = width / height
    
    # Calculate scaling factors for width and height
    width_scale = MAX_IMAGE_WIDTH / width
    height_scale = MAX_IMAGE_HEIGHT / height

    # Determine the scaling factor to ensure the image fits within both max width and max height
    scale_factor = min(width_scale, height_scale)

    # If the scale factor is less than 1, the image is being scaled down
    if scale_factor < 1:
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        image = image.resize((new_width, new_height))
    
    # Saving the image
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    image.save(dest, optimize=True, quality=85)

# def get_scryfall_image_url(card_name):
#     # Scryfall API to get card info by name
#     base_url = "https://api.scryfall.com/cards/named"
#     params = {'fuzzy': card_name}
#     response = requests.get(base_url, params=params)

#     if response.status_code == 200:
#         data = response.json()
#         # Return the image URL for the card
#         return data['image_uris']['normal']
#     else:
#         print(f"Error fetching card data for {card_name}")
#         return None

# def replace_card_names_with_images(input_text):
#     # Regular expression to find card names enclosed in double brackets
#     card_pattern = r'\[\[([^\]]+)\]\]'
    
#     def replace_card(match):
#         card_name = match.group(1)
#         image_url = get_scryfall_image_url(card_name)
        
#         if image_url:
#             # Create HTML image tag with better scaling properties
#             return f'<img src="{image_url}" class="card-image" alt="{card_name}">'
#         else:
#             return match.group(0)

#     # Find all instances of card clumps (sequences of card names)
#     clump_pattern = r'(\[\[[^\]]+\]\](?:\s*\[\[[^\]]+\]\])*)'
    
#     def wrap_in_div(clump_match):
#         clump = clump_match.group(1)
#         # Count the number of cards in this clump
#         card_count = len(re.findall(card_pattern, clump))
#         # Replace card names with image tags
#         clump_with_images = re.sub(card_pattern, replace_card, clump)
#         # Add a dynamic CSS variable to control sizing based on card count
#         return f'<div class="card-container" style="--card-count: {card_count};">{clump_with_images}</div>'
    
#     # Replace clumps with styled containers
#     result = re.sub(clump_pattern, wrap_in_div, input_text)
        
#     return result


if __name__ == '__main__':
    shutil.rmtree('site')
    Path('site').mkdir()
    for path in Path('source').glob('**/*'):
        if str(path).endswith(".md") and not os.path.isdir(path):
            print(path)
            s = SitePage(path)
            s.export()
        elif os.path.isfile(path):
            if imghdr.what(path):
                copy_image(path)
            else:
                copy_file(path)
 # type: ignore