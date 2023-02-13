#!/usr/bin/env python3
"""
Dan's static site generator

This is my first attempt at a PEP 8-compilant python script that I can be
proud of. It is and will always be designed for personal use but can easily be
borrowed by replacing the contents of the 'source' folder.

TODO: turn written links into hyperlinks automatically
TODO: gitpython integration for tracking which pages need to be (re)generated
TODO: gitpython integration for pushing to github pages
TODO: do images work? - no
TODO: some sort of header and footer? or just templating?
TODO: autogenerating links to internal pages
TODO: Fix cwd to always be based off of this file
TODO: Autopopulate site photo folders from linking files on disk in the source
"""
import glob
import os
import sys
import shutil

from markdown_it import MarkdownIt
from pathlib import Path


md = (
	MarkdownIt()
	.enable('image')
	.enable('table')
)

class SitePage:
	"""SitePage class that is instantiated for each file in the source dir.

	HTML files will be mirrored in the same directory structure with the
	same name as their source markdown files.
	"""
	def add_site_sources(self, html_doc):
		css = '<link rel="stylesheet" href="/css/site.css">\n'
		return css + html_doc

	def add_highlight_js_tags(self, html_doc):
		link_tag = '<link rel="stylesheet" href="/css/highlight.css">\n'
		script_tag = '<script src="/js/highlight.min.js"></script>\n'
		run_tag = '<script>hljs.highlightAll();</script>\n'
		return link_tag + script_tag + run_tag + html_doc

	def personalize(self, html_doc):
		out = self.add_site_sources(html_doc)
		if "<code" in out:
			out = self.add_highlight_js_tags(out)
		return out


	def __init__(self, path):
		self.path = path
		self.text = path.open('r').read()
		self.html = self.personalize(md.render(self.text))
		#temporary path transormations to help create mirrored html file
		p         = path.relative_to('source').with_suffix('.html')
		self.out  = Path('site').joinpath(p)


	def export(self):
		"""Writes generated markdown to its mirrored location within the
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
			dest = Path('site').joinpath(p)
			os.makedirs(os.path.dirname(dest), exist_ok=True)
			shutil.copy(path, dest)
