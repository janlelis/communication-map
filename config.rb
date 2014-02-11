set :css_dir, 'assets/css'
set :js_dir, 'assets/js'
set :images_dir, 'assets/images'
set :layout, false

set :palava_domain, 'https://palava.tv'
set :chrome, 'Google Chrome'
set :chrome_description, 'Google Chrome 26 or above'
set :chrome_link, 'https://google.com/chrome'
set :firefox, 'Mozilla Firefox'
set :firefox_description, 'Mozilla Firefox 22 or above'
set :firefox_link, 'https://www.mozilla.org/firefox'

# - - -

activate :bower

# - - -

configure :build do
  ignore 'assets/js/**/*'
  activate :asset_hash
  activate :minify_css
  # set :http_path, "/Content/images/"
end


###
# Page options, layouts, aliases and proxies
###

# Per-page layout changes:
#
# With no layout
# page "/path/to/file.html", :layout => false
#
# With alternative layout
# page "/path/to/file.html", :layout => :otherlayout
#
# A path which all have the same layout
# with_layout :admin do
#   page "/admin/*"
# end

# Proxy (fake) files
# page "/this-page-has-no-template.html", :proxy => "/template-file.html" do
#   @which_fake_page = "Rendering a fake page with a variable"
# end

###
# Compass
###

# Susy grids in Compass
# First: gem install susy
# require 'susy'

# Change Compass configuration
# compass_config do |config|
#   config.output_style = :compact
# end

###
# Helpers
###

# Automatic image dimensions on image_tag helper
# activate :automatic_image_sizes

# Methods defined in the helpers block are available in templates
# helpers do
#   def some_helper
#     "Helping"
#   end
# end
