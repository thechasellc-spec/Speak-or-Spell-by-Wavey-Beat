#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "PluginEditor.h"

SpeakOrSpellAudioProcessorEditor::SpeakOrSpellAudioProcessorEditor(SpeakOrSpellAudioProcessor& p)
    : AudioProcessorEditor(&p), processor(p)
{
    setResizable(true, true);
    setResizeLimits(360, 280, 760, 520);
    setSize(480, 350);

    auto setupSlider = [](juce::Slider& slider)
    {
        slider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 64, 20);
        slider.setColour(juce::Slider::rotarySliderFillColourId, juce::Colour(0xffd96a3b));
        slider.setColour(juce::Slider::thumbColourId, juce::Colour(0xff263b2d));
        slider.setColour(juce::Slider::textBoxTextColourId, juce::Colour(0xff263b2d));
        slider.setColour(juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    };
    setupSlider(voicesSlider);
    setupSlider(spreadSlider);
    setupSlider(characterSlider);
    voicesSlider.setRange(1, 8, 1);
    spreadSlider.setRange(0.0, 30.0, 0.1);
    characterSlider.setRange(0.0, 1.0, 0.01);
    characterSlider.setTextValueSuffix(" blend");

    auto setupLabel = [](juce::Label& label, const juce::String& text)
    {
        label.setText(text, juce::dontSendNotification);
        label.setJustificationType(juce::Justification::centred);
        label.setColour(juce::Label::textColourId, juce::Colour(0xff2b2b23));
        label.setFont(juce::Font(juce::FontOptions(12.0f, juce::Font::bold)));
    };
    setupLabel(voicesLabel, "CHOIR VOICES");
    setupLabel(spreadLabel, "DETUNE / WIDTH");
    setupLabel(characterLabel, "VOICE CHARACTER");
    juce::Component* components[] = { &voicesSlider, &spreadSlider, &characterSlider,
                                      &voicesLabel, &spreadLabel, &characterLabel };
    for (auto* component : components)
        addAndMakeVisible(component);

    voicesAttachment = std::make_unique<SliderAttachment>(processor.parameters, "CHOIR_VOICES", voicesSlider);
    spreadAttachment = std::make_unique<SliderAttachment>(processor.parameters, "CHOIR_SPREAD", spreadSlider);
    characterAttachment = std::make_unique<SliderAttachment>(processor.parameters, "VOICE_CHARACTER", characterSlider);
}
void SpeakOrSpellAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff171916));
    g.setColour(juce::Colour(0xffc7b99a));
    g.fillRoundedRectangle(getLocalBounds().toFloat().reduced(12), 16.0f);
    g.setColour(juce::Colour(0xff2b2b23));
    g.setFont(juce::Font(juce::FontOptions(23.0f, juce::Font::bold)));
    g.drawFittedText("SPEAK OR SPELL", 18, 15, getWidth()-36, 34, juce::Justification::centred, 1);
    g.setColour(juce::Colour(0xffd96a3b));
    g.setFont(juce::Font(juce::FontOptions(11.0f, juce::Font::bold)));
    g.drawFittedText("BY WAVEY BEAT  /  CHOIR LAB", 18, 48, getWidth()-36, 20, juce::Justification::centred, 1);
    g.setColour(juce::Colour(0xffb9c9a0));
    g.fillRoundedRectangle(28.0f, 76.0f, (float)getWidth()-56.0f, 48.0f, 5.0f);
    g.setColour(juce::Colour(0xff263b2d));
    g.setFont(juce::Font(juce::FontOptions(14.0f, juce::Font::bold)));
    g.drawFittedText("MIDI CHOIR ENGINE", 34, 84, getWidth()-68, 30, juce::Justification::centred, 1);
    g.setColour(juce::Colour(0xff40382b));
    g.setFont(juce::Font(juce::FontOptions(10.0f)));
    g.drawFittedText("Layered pitched vocal tones - lyrics / AI singing engine planned next", 18, getHeight()-25, getWidth()-36, 16, juce::Justification::centred, 1);
}
void SpeakOrSpellAudioProcessorEditor::resized()
{
    const int margin = 24;
    const int areaTop = 137;
    const int colWidth = (getWidth() - margin * 2) / 3;
    const int labelY = areaTop;
    const int sliderY = areaTop + 22;
    const int sliderH = juce::jmax(100, getHeight() - sliderY - 36);
    juce::Component* labels[] = { &voicesLabel, &spreadLabel, &characterLabel };
    juce::Component* sliders[] = { &voicesSlider, &spreadSlider, &characterSlider };
    for (int i = 0; i < 3; ++i)
    {
        const int x = margin + i * colWidth;
        labels[i]->setBounds(x, labelY, colWidth, 20);
        sliders[i]->setBounds(x, sliderY, colWidth, sliderH);
    }
}
