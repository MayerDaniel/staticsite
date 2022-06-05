#!/usr/bin/env python3
"""
Dan's static site generator

This is my first attempt at a PEP 8-compilant python script that I can be
proud of. It is and will always be designed for personal use but can easily be
borrowed by replacing the contents of the 'source' folder.

TODO: gitpython integration
TODO: do images work?
TODO: some sort of header and footer? or just templating?
TODO: autogenerating links to internal pages
TODO: Fix cwd to always be based off of this file
TODO: Autopopulate site photo folders from linking files on disk in the source
"""
import sys
from markdown_it import MarkdownIt
import glob
from pathlib import Path
import shutil

"""
Global variables
"""
md = (
    MarkdownIt()
    .enable('image')
    .enable('table')
)

source = Path('source')

class SitePage:
		def __init__(self, path):
			self.path = path
			self.text = path.open('r').read()
			self.html = md.render(self.text)

			p         = path.relative_to('source').with_suffix('.html')
			self.out  = Path('site').joinpath(p)


		def generate(self):
			self.out.parent.mkdir(exist_ok=True, parents=True)
			self.out.write_text(self.html)





if __name__ == '__main__':
	shutil.rmtree('site')
	for path in source.glob('**/*.md'):
		s = SitePage(path)
		s.generate()
