# install and link gems
system('bundle -j4')

gems_dir = File.expand_path(Dir.glob('vendor/bundle/ruby/*')[0]) + '/gems'
linked_gems = File.expand_path('vendor/gems')

File.unlink(linked_gems) if File.exist?(linked_gems)

system("ln -s #{gems_dir} #{linked_gems}")

# add bin to paths

bin_dir = File.expand_path('bin')

path_line = "# forge CLI\nexport PATH=\"$PATH:#{bin_dir}\""

['.bashrc', '.profile', '.bash_profile'].each do |file|
  filename = File.expand_path("~/#{file}")
  next if !File.exist?(filename)
  file_content = File.read(filename)
  next if file_content.include?(path_line)
  file_content << "\n#{path_line}\n"
  File.open(filename, 'w+') { |f| f.write (file_content) }
  puts "#{filename} was updated"
end
