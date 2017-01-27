class Deployer

  def initialize(input_directory)
    @input_directory = input_directory
  end

  def deploy_to(domain)
    say 'Creating archive...'
    zipfile_name = create_archive
    say " done.\n"
    say 'Sending data...'
    endpoint = "#{ENV['FORGE_URL']}/external_api/v2/cli/deploy"
    @response = RestClient.post(endpoint, archive: File.open(zipfile_name),
                                          domain: domain,
                                          site_tokens: get_site_token(domain))
    # File.open(zipfile_name) do |archive|
    #   req = Net::HTTP::Post::Multipart.new(
    #     endpoint.path,
    #     archive: UploadIO.new(archive, 'application/zip', 'archive.zip'),
    #     domain: domain,
    #     token: credentials['token']
    #   )
    #   @response = Net::HTTP.start(endpoint.host, endpoint.port) do |http|
    #     http.request(req)
    #   end
    # end
    success do
      say("#{domain} successfully added to deploy queue.")
    end
  end

  def create_archive
    zipfile_name = File.join(Dir.mktmpdir, 'archive.zip')
    Zip::File.open(zipfile_name, Zip::File::CREATE) do |zipfile|
      recursive_add_directory(zipfile, @input_directory)
    end
    zipfile_name
  end

  def recursive_add_directory(zipfile, directory, parent = nil)
    entries = Dir.entries(directory) - ['.', '..']
    entries.each do |entry|
      fullpath = File.join(directory, entry)
      filename = parent ? File.join(parent, entry) : entry
      if File.directory?(fullpath)
        recursive_add_directory(zipfile, fullpath, filename)
      else
        zipfile.add(filename, File.join(directory, entry))
      end
    end
  end

  def get_site_token(domain)
    credentials['site_tokens'][domain]
  end
end
