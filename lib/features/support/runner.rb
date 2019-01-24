require 'open3'

After do |scenario|
  # Make sure that any scripts are killed between test runs
  # so future tests are run from a clean slate.
  Runner.kill_running_scripts
end

SCRIPT_PATH = File.expand_path(File.join(File.dirname(__FILE__), "..", "scripts"))

class Runner
  class << self
    # If the command is blocking then the output and exit status is
    # returned. The output from the command is always printed in
    # debug mode - so this is just so the caller can verify something
    # about the output.
    def run_command(cmd, blocking: true, success_codes: [0])
      executor = lambda do
        $logger.debug(cmd) { 'executing' }

        Open3.popen2e(environment, cmd) do |stdin, stdout_and_stderr, wait_thr|
          # Add the pid to the list of pids to kill at the end
          pids << wait_thr.pid unless blocking

          output = []
          stdout_and_stderr.each do |line|
            output << line
            $logger.debug(cmd) {line}
          end

          exit_status = wait_thr.value.to_i
          $logger.debug(cmd) { "exit status: #{exit_status}" }

          # if the command fails we log the output at warn level too
          if success_codes != nil && !success_codes.include?(exit_status) && $logger.level != Logger::DEBUG
            output.each {|line| $logger.warn(cmd) {line}}
          end

          return [output, exit_status]
        end
      end

      if blocking
        executor.call
      else
        Thread.new &executor
      end
    end

    # Runs a script in the script directory in maze runner
    def run_script script_name, blocking: false, success_codes: [0]
      script_path = File.join(SCRIPT_PATH, script_name)
      script_path = File.join(Dir.pwd, script_name) unless File.exists? script_path
      if Gem.win_platform?
        # windows does not support the shebang that we use in the scripts so it
        # needs to know how to execute the script. Passing `cmd /c` tells windows
        # to use it's known file associations to execute this path. If ruby is
        # installed on windows then it will know that `rb` files should be exceuted
        # using ruby etc.
        script_path = "cmd /c #{script_path}"
      end
      return run_command(script_path, blocking: blocking, success_codes: success_codes)
    end

    def kill_running_scripts
      pids.each {|p|
        begin
          Process.kill("KILL", p)
        rescue Errno::ESRCH
        end
      }
      pids.clear
    end

    def environment
      @env ||= {}
    end

    private
    def pids
      @pids ||= []
    end
  end
end