import importlib.util
import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


AI_SERVICES_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULE_PATH = os.path.join(
    AI_SERVICES_DIR, 'routes', 'processing', 'youtube_cache.py'
)


class _Blueprint:
    def __init__(self, *_args, **_kwargs):
        pass

    def route(self, *_args, **_kwargs):
        return lambda function: function


flask_stub = types.ModuleType('flask')
flask_stub.Blueprint = _Blueprint
flask_stub.jsonify = lambda *args, **kwargs: (args, kwargs)
routes_stub = types.ModuleType('routes')
routes_stub.__path__ = []
processing_stub = types.ModuleType('routes.processing')
processing_stub.__path__ = []
utils_stub = types.ModuleType('routes.utils')
utils_stub.get_youtube_dir = lambda: ''

with patch.dict(sys.modules, {
    'flask': flask_stub,
    'routes': routes_stub,
    'routes.processing': processing_stub,
    'routes.utils': utils_stub,
}):
    spec = importlib.util.spec_from_file_location(
        'routes.processing.youtube_cache', MODULE_PATH
    )
    youtube_cache = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(youtube_cache)
resolve_youtube_cache_folder = youtube_cache.resolve_youtube_cache_folder


class YouTubeCachePathTests(unittest.TestCase):
    def test_preserves_encoded_apostrophe_in_folder_name(self):
        with tempfile.TemporaryDirectory() as base_dir:
            folder_name = "Guns N%27 Roses - Knockin%27 on Heaven%27s Door"

            resolved = resolve_youtube_cache_folder(base_dir, folder_name)

            self.assertEqual(resolved, os.path.join(os.path.abspath(base_dir), folder_name))
            self.assertNotIn("Guns N' Roses", resolved)

    def test_rejects_folder_outside_cache_directory(self):
        with tempfile.TemporaryDirectory() as base_dir:
            with self.assertRaises(ValueError):
                resolve_youtube_cache_folder(base_dir, os.path.join('..', 'outside'))


if __name__ == '__main__':
    unittest.main()
