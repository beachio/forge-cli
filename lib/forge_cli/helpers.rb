def response
  @response_object ||= JSON.parse(@response.body) rescue {}
end

def unauthorized_message
  say(response['error'] || 'Invalid email or password.')
end

def hello_message
  say("Hi, #{credentials['name']}! You are logged in.")
end

def server_error_message
  say('Server responded with error, please try again later.')
end

def unprocessable_message
  say '[ERROR] ' + (response['error'] || 'Server cannot process the request.')
end

def success
  case @response.code.to_s
  when /20\d/
    yield if block_given?
  when /401/ then unauthorized_message
  when /422/ then unprocessable_message
  when /50\d/ then server_error_message
  else
    say("Unknown response, code: #{@response.code}")
  end
end

def get_tokens hash
  if hash.is_a?(Hash)
    hash.values.join(',')
  else
    hash
  end
end
