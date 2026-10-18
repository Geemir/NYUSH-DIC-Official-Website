source "https://rubygems.org"

# Build exactly like GitHub Pages does (Jekyll 3.10 + whitelisted plugins).
# Run locally with:  bundle exec jekyll serve
gem "github-pages", group: :jekyll_plugins

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-include-cache"
end

# Ruby 3+ no longer bundles webrick, which `jekyll serve` needs.
gem "webrick", "~> 1.8"

# Windows and JRuby do not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds since newer versions of the gem
# do not have a Java counterpart.
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]
