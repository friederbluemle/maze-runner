# Maze Runner 🏃

A test runner for validating requests

## How it works

The test harness launches a mock API which awaits requests from sample
applications. Using the runner, each scenario is executed and the requests are
validates to have to correct fields and values. Uses Gherkin and Cucumber under
the hood to draft semantic tests.

## Setting up a new project

1. Install the `bundler` gem:

   ```
   gem install bundler
   ```
2. Add a Gemfile to the root of your project:

   ```ruby
   source "https://rubygems.org"

   gem "bugsnag-maze-runner", git: "https://github.com/bugsnag/maze-runner"
   ```
3. Run `bundle install` to fetch and install Maze Runner
4. Run 

   ```
   bundle exec maze-runner init
   ``` 
   from the root of your project to build the basic structure to run test scenarios.

The `features` directory in your project is expected to be laid out as follows:

   * `features`
      * `fixtures`: Test fixture files, such as sample JSON payloads
      * `scripts`: Scripts to be run in scenarios. Any environment
        variables set in scenarios are passed to scripts. The `MOCK_API_PORT`
        variable is provided by default to configure the location of the mock
        server.
      * `steps`: Additional steps of the form Given/When/Then required to
        complete scenarios
      * `support`: Helper functions. Add any setup which should be run
        once before all of the scenarios to `features/support/env.rb`. Any setup
        which should be run before or after each scenario can go into special
        `Before` and `After` functions respectively.
      * `*.feature`: The plain text scenario specifications

   A sample feature is included after running `init`. Try it out with:

   ```
   bundle exec maze-runner
   ```

## Writing features

Features should be composed as concisely has possible, reusing existing steps as
needed. The harness provides a number of reusable step definitions for
interacting with scripts, setting environment variables, and inspecting output.
Each new feature should go into a `.feature` file in the `features` directory.

```gherkin
Feature: Sinatra support

Scenario: Sinatra unhandled exception
    When I set environment variable "BUGSNAG_API_KEY" to "a35a2a72bd230ac0aa0f52715bbdc6aa"
    And I start a Sinatra app
    And I navigate to the route "/syntax-error"
    Then I should receive a request
    And the request is a valid for the error reporting API
    And the "Bugsnag-API-Key" header equals "a35a2a72bd230ac0aa0f52715bbdc6aa"
    And the event "unhandled" is true
```

This example includes a mix of the included steps as well as custom ones
specific to the library being tested. `When I set an environment variable` is
provided by default while `When I start a Sinatra app` is defined in a custom
steps file in `features/steps/`, wrapping other included steps:

```ruby
When("I start a Sinatra app") do
  set_script_env "DEMO_APP_PORT", "#{DEMO_APP_PORT}"
  steps %Q{
    When I run the script "features/fixtures/run_sinatra_app.sh"
    And I wait for 8 seconds
  }
end

When("I navigate to the route {string}") do |route|
  steps %Q{
    When I open the URL "http://localhost:#{DEMO_APP_PORT}#{route}"
    And I wait for 1 second
  }
end
```

In addition, any helper functions or instance variables defined in
`features/support/env.rb` are available to step files. See the included
`_step.rb` files for examples. The files in `features/support` are evaluated
before scenarios are run, so this is where one-time or per-scenario
configuration should go.

 ```ruby
 # A helper function included with the harness to run commands and
 # only print output when the command fails
 run_required_commands([
   ["bundle", "install"]
 ])

 # Maybe shell out to something directly, if necessary
 `echo Peanut Butter Jelly Time`

 # Run before every scenarios
 Before do
   clean_build_artifacts
 end

# Run after every scenario
After do |scenario|
  # Teardown scenario configuration here

  if scenario.failed?
    # Can be used to do specific cleanup if a scenario fails
  end
end
 ```

### Step reference

A whirlwind tour of the most important bundled steps. Additional variants exist for checking value nullability, "starts with", "ends with", et cetera.

Anywhere a `{field}` is denoted, it can be replaced with dot-delimited key path to indicate the path from the root of an object to the intended target.

For example, to match the name of the second objects in the the key `fruits` below, use `fruits.1.name` as the keypath.

```
{
  "fruits": [
  	{ "name": "apple" },
  	{ "name": "cherry" }
  ]
}
```


#### When ...

|Step | Description |
|-----|-------------|
|I set environment variable "{key}" to "{value}" | Make an environment variable available to any scripts which run afterwards
|I run the script "{path}" | Run the file denoted by `{path}`. It must be marked as executable
|I run the script "{path}" synchronously | Run the file denoted by `{path}`, waiting for it to finish. It must be marked as executable
|I open the URL "{url}"|Fetch the contents of a URL
|I open the URL "{url}" in a browser|Open a URL in the system's default browser
|I open the URL "{url}" in "{browser}"|Open a URL in a specified browser (Only fully implemented for macOS)

#### Then ...

|Step | Description |
|-----|-------------|
|I should receive {n} requests|Assert that the mock server received _n_ requests
|I should receive a request|Assert that the mock server received one request
|the "{name}" header is not null|Assert that the {name} header is set
|the "{name}" header equals "{value}"|Assert that the value of the {name} header is `{value}`
|the "{name}" header is a timestamp|Assert that the value of the {name} header is an ISO8601 timestamp
|the payload body matches the JSON fixes in "{path}"|Assert that the body of a request matches a template in a .json file
|the payload field "{field}" matches the JSON fixture in "{path}"|Assert that a subset of a request body matches a template in a .json file
|the request is a valid for the error reporting API|The correct headers are set, there is at least one event present, every event has a severity, etc
|the event "{field}" equals "{value}"|Assert that a field in the first event in the first request equals a string
|the exception "{field}" equals "{value}"|Assert that a field in the first exception in the first event in the first request equals a string
|the "{field}" of stack frame {n} equals "{value}"|You get the idea

### On matching JSON templates

For the following steps:

```gherkin
Then the payload body matches the JSON fixture in "features/fixtures/template.json"
Then the payload field "items.0.subset" matches the JSON fixture in "features/fixtures/template.json"
```

The template file can either be an exact match or specify regex matches for string fields. For example, given the template

```json
{ "fruit": { "apple": { "color": "\\w+" } } }
```

The following request will match:

```json
{ "fruit": { "apple": { "color": "red" } } }
```

Though this request will not match:

```json
{ "fruit": { "apple": { "color": "red-orange" } } }
```

If "IGNORE" is specified as a value in a template, that value will be ignored in requests.

Given the following template:

```json
{ "fruit": { "apple": "IGNORE" } }
```

This request will match:

```json
{ "fruit": { "apple": "some nonsense" } }
```

# On dealing with multiple requests

Most payload assertion steps have optional suffix of `for request n` where `n` is a
zero-based index into chronologically ordered collection of requests received by the
mock server. If you leave off this suffix, the default behaviour is to run the step
against request `0`, i.e. the first (and perhaps only) request.

## Running features

Run the entire suite using 

```
bundle exec maze-runner
``` 

Alternately, you can specify specific files to run:

```
bundle exec maze-runner features/something.feature
```

If you know the line number it's declared on you can run a single
Scenario by appending the line number to the feature:

```
bundle exec maze-runner features/something.feature:123
```

Append the `--verbose` option to either form to print script output and a trace of what Ruby file
is being run.

## Logging data on scenario failures

In the event of a scenario failure there are additional ways of retrieving useful
information.

### Failed payloads

When a scenario fails all received payloads will automatically be written to a
`maze_output` folder found in the directory the tests were run from.

Each file will be named with the format:
`{scenario-name}-request{request-number}-{date}.log`

Data written to each file will include:
- `URI`: The URI target for the request
- `HEADERS`: The headers included in the request
- `BODY`: The body included in the request in JSON format

### Outputting additional data

In certain circumstances access to logs or additional information from the
`--verbose` flag may not be available, such as when running the tests via CI.

In these cases a method can be created in the project's local `env.rb` file called
`output_logs`. This function will be called in the event of a scenario failure.

## Troubleshooting

### Known issues

* Testing on iOS sometimes fails while Android Studio or gradle or some Android
  emulators are running.
* Payload field matching for raw string values can be ambiguous when there is a
  possible regex match (e.g. when using "." as a part of an expected value
  without escaping it).

## Contributing

If steps would be useful for different projects running the maze, add the step(s) 
to `lib/features/steps/`. If there are useful helper functions, add them to
`lib/features/support/*.rb`.

### Running the tests

`maze-runner` uses `test-unit` and `minunit` to bootstrap itself and run the
sample app suites in the test fixtures. Run 

```
bundle exec rake
``` 

to run the suite.
