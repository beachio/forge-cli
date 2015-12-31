def save_credentials
  Store.set('credentials', response)
end

def clear_credentials
  Store.drop('credentials')
end

def credentials
  Store.get('credentials')
end

def authenticate
  unless credentials
    say('You must log in first.')
    exit(1)
  end
end
