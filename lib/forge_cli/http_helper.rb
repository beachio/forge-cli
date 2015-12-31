def http_get(path, params)
  uri = URI.parse("#{ENV['FORGE_URL']}/api/cli/sites")
  uri.query = URI.encode_www_form(params.merge(token: credentials['token']))
  @response = Net::HTTP.get(uri)
end
