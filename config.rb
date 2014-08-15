project_type = "stand_alone"
project_path = "client/"
http_path = project_path
sass_dir = ".sass/"
css_dir = "public/src/css"
javascripts_dir = "public/src/js"
fonts_dir = "public/fonts"
images_dir = "public/img"
generated_images_dir = "public/img/sprites"

require "animation" # gem install animation --pre
require "breakpoint" # gem install breakpoint

Sass::Script::Number.precision = 3

# You can select your preferred output style here (can be overridden via the command line):
# output_style = :expanded or :nested or :compact or :compressed
# output_style = :compressed;

# To enable relative paths to assets via compass helper functions. Uncomment:
relative_assets = true

# Allows you to call, for example, image-url('foobar.gif') instead of image-url('foobar.gif', false, false) to remove cache busting query string
asset_cache_buster :none

# To disable debugging comments that display the original location of your selectors. Uncomment:
line_comments = true

# If you prefer the indented syntax, you might want to regenerate this
# project again passing --syntax sass, or you can uncomment this:
# preferred_syntax = :sass
# and then run:
# sass-convert -R --from scss --to sass sass scss && rm -rf sass && mv scss sass