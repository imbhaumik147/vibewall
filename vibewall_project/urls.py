"""
URL configuration for vibewall_project.
"""

import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve

from django.http import HttpResponse

def serve_root_file(filename, content_type):
    filepath = os.path.join(settings.BASE_DIR, filename)
    def view(request):
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = ''
        return HttpResponse(content, content_type=content_type)
    return view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('google0258ad434ea15a83.html', lambda req: HttpResponse('google-site-verification: google0258ad434ea15a83.html', content_type='text/html')),
    path('sitemap.xml', serve_root_file('sitemap.xml', 'application/xml')),
    path('robots.txt', serve_root_file('robots.txt', 'text/plain')),
    path('llms.txt', serve_root_file('llms.txt', 'text/plain')),
    path('llm.txt', serve_root_file('llm.txt', 'text/plain')),
    path('', include('wallpapers.urls')),
]

# Explicit static file handler for Serverless / Vercel
static_dir = os.path.join(settings.BASE_DIR, 'static')
urlpatterns += [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': static_dir}),
]

if settings.DEBUG:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
