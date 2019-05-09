Given("the element {string} is present") do |element_id|
  @driver.wait_on_element(element_id)
end
When("I click the element {string}") do |element_id|
  @driver.click_element(element_id)
end
Given("I send the app to the background for {int} seconds") do |timeout|
  @driver.timeout_app(timeout)
end