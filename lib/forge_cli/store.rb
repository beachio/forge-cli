class Store
  class << self
    def data_dir
      File.expand_path(File.join(File.dirname(__FILE__), '..', '..', 'data'))
    end

    def set(key, value)
      data = value.class == String ? value : value.to_json
      File.open(File.join(Store.data_dir, key), 'w+') { |f| f.write(data) }
      value
    end

    def get(key)
      return nil unless File.exist?(File.join(Store.data_dir, key))
      data = File.read(File.join(Store.data_dir, key))
      JSON.parse(data) rescue data
    end

    def add(key, value_key, value)
      data = Store.get(key)
      if data.nil?
        Store.set(key, { value_key => value })
      else
        data[value_key] = value
        Store.set(key, data)
      end
    end

    def remove(key, value_key)
      data = Store.get(key)
      return if data.nil?
      data.delete(value_key)
      Store.set(key, data)
    end

    def drop(key)
      File.unlink(File.join(Store.data_dir, key))
    end

    def add_to_exist(key, value_key, value)
      data = Store.get(key)
      if data.nil?
        Store.set(key, { value_key => value })
      else
        if value.any?
          value.keys.each do |key|
            data[value_key][key] = value[key]
          end
        end
        Store.set(key, data)
      end
    end
  end
end
