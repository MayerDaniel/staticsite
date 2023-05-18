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
import glob
import os
import sys
import shutil
import re

from markdown_it import MarkdownIt
from pathlib import Path


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
        out = self.add_head(out)
        return out

    def export(self):
        """
        Writes generated markdown to its mirrored location within the
        'site' directory.
        """
        self.out.parent.mkdir(exist_ok=True, parents=True)
        self.out.write_text(self.html)



if __name__ == '__main__':
    shutil.rmtree('site')
    Path('site').mkdir()
    for path in Path('source').glob('**/*'):
        if str(path).endswith(".md") and not os.path.isdir(path):
            print(path)
            s = SitePage(path)
            s.export()
        elif os.path.isfile(path):
            p = path.relative_to('source')
            # ensure extension is lowercase because github.io doesn't track it
            dest = Path('site').joinpath(p)
            file_extension = dest.suffix
            lowercase_extension = file_extension.lower()
            dest = dest.with_suffix(lowercase_extension)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy(path, dest)
