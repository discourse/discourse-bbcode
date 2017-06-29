require 'rails_helper'

describe PrettyText do
  before do
    SiteSetting.enable_experimental_markdown_it = true
  end

  it 'can apply color bbcode' do
    cooked = PrettyText.cook "hello [color=red]RED[/color] world"
    html = '<p>hello <font color="red">RED</font> world</p>'

    expect(cooked).to eq(html)
  end

  it 'can apply size bbcode' do
    cooked = PrettyText.cook "hello [size=100]BIG[/size] text"
    html = '<p>hello <font size="100">BIG</font> text</p>'

    expect(cooked).to eq(html)
  end

  it 'can apply font bbcode' do
    cooked = PrettyText.cook "hello [font=usa]usa[/font] text"
    html ='<p>hello <font face="usa">usa</font> text</p>'

    expect(cooked).to eq(html)
  end

  it 'can apply small bbcode' do
    cooked = PrettyText.cook "hello [small]usa[/small] text"
    html = '<p>hello <span style="font-size:x-small">usa</span> text</p>'

    puts cooked
    expect(cooked).to eq(html)
  end

  it 'can apply highlight bbcode' do
    cooked = PrettyText.cook "hello [highlight]highlight[/highlight] text"
    html = '<p>hello <span class="highlight">highlight</span> text</p>'

    expect(cooked).to eq(html)
  end

  it 'can apply left center and right' do
    markdown = <<~MD
    [left]
    I am aligned to the left

    **yay**
    [/left]

    [center]

    I am in the *middle*

    [/center]

    [right]

    and I am too the right

    [/right]
    MD
    cooked = PrettyText.cook markdown
    html = ''

    puts cooked
    expect(cooked).to eq(html)
  end
end

