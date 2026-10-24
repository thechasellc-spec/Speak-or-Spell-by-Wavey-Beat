#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class SpeakOrSpellAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit SpeakOrSpellAudioProcessorEditor(SpeakOrSpellAudioProcessor&);
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    SpeakOrSpellAudioProcessor& processor;
    juce::Slider voicesSlider, spreadSlider, characterSlider;
    juce::Label voicesLabel, spreadLabel, characterLabel;
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    std::unique_ptr<SliderAttachment> voicesAttachment, spreadAttachment, characterAttachment;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SpeakOrSpellAudioProcessorEditor)
};
