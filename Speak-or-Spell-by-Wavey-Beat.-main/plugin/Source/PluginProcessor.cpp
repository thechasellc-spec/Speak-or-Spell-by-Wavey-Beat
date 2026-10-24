#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "PluginEditor.h"

SpeakOrSpellAudioProcessor::SpeakOrSpellAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "SpeakOrSpellParameters", createParameterLayout()) {}

juce::AudioProcessorValueTreeState::ParameterLayout SpeakOrSpellAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterInt>("CHOIR_VOICES", "Choir Voices", 1, 8, 3));
    layout.add(std::make_unique<juce::AudioParameterFloat>("CHOIR_SPREAD", "Choir Spread", juce::NormalisableRange<float>(0.0f, 30.0f, 0.1f), 8.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("VOICE_CHARACTER", "Voice Character", juce::NormalisableRange<float>(0.0f, 1.0f, 0.01f), 0.5f));
    return layout;
}

void SpeakOrSpellAudioProcessor::prepareToPlay(double sampleRate, int)
{
    sampleRateHz = sampleRate;
    voices.clear();
}
void SpeakOrSpellAudioProcessor::releaseResources() { voices.clear(); }

bool SpeakOrSpellAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::mono() || out == juce::AudioChannelSet::stereo();
}

void SpeakOrSpellAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();
    for (const auto metadata : midi)
    {
        const auto message = metadata.getMessage();
        if (message.isNoteOn())
        {
            const int note = message.getNoteNumber();
            Voice v;
            v.note = note;
            v.phase = 0.0;
            v.increment = juce::MathConstants<double>::twoPi * juce::MidiMessage::getMidiNoteInHertz(note) / sampleRateHz;
            v.level = message.getFloatVelocity() * 0.16f;
            v.releasing = false;
            voices[note] = v;
        }
        else if (message.isNoteOff())
        {
            auto it = voices.find(message.getNoteNumber());
            if (it != voices.end()) it->second.releasing = true;
        }
        else if (message.isAllNotesOff() || message.isAllSoundOff())
        {
            voices.clear();
        }
    }

    const int channels = buffer.getNumChannels();
    const int layerCount = juce::jlimit(1, 8, (int)parameters.getRawParameterValue("CHOIR_VOICES")->load());
    const double spreadCents = parameters.getRawParameterValue("CHOIR_SPREAD")->load();
    const double character = parameters.getRawParameterValue("VOICE_CHARACTER")->load();

    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        float mixed = 0.0f;
        for (auto it = voices.begin(); it != voices.end();)
        {
            auto& v = it->second;
            double layered = 0.0;
            for (int layer = 0; layer < layerCount; ++layer)
            {
                const double centered = layerCount == 1 ? 0.0 : (double(layer) / double(layerCount - 1) - 0.5) * 2.0;
                const double detune = std::pow(2.0, (centered * spreadCents) / 1200.0);
                const double phase = v.phase * detune + (layer * 0.173);
                const double fundamental = std::sin(phase);
                const double second = std::sin(phase * 2.0) * (0.22 + 0.30 * character);
                const double third = std::sin(phase * 3.0) * (0.28 - 0.13 * character);
                const double nasal = std::sin(phase * 5.0) * (0.07 + 0.08 * character);
                layered += fundamental + second + third + nasal;
            }
            layered /= std::sqrt((double)layerCount);
            mixed += static_cast<float>(layered) * v.level;
            v.phase += v.increment;
            if (v.phase >= juce::MathConstants<double>::twoPi)
                v.phase = std::fmod(v.phase, juce::MathConstants<double>::twoPi);
            if (v.releasing)
            {
                v.level *= 0.9975f;
                if (v.level < 0.0005f) { it = voices.erase(it); continue; }
            }
            ++it;
        }
        mixed = juce::jlimit(-0.85f, 0.85f, mixed);
        for (int channel = 0; channel < channels; ++channel)
            buffer.setSample(channel, sample, mixed);
    }
}

juce::AudioProcessorEditor* SpeakOrSpellAudioProcessor::createEditor()
{
    return new SpeakOrSpellAudioProcessorEditor(*this);
}
bool SpeakOrSpellAudioProcessor::hasEditor() const { return true; }
const juce::String SpeakOrSpellAudioProcessor::getName() const { return JucePlugin_Name; }
bool SpeakOrSpellAudioProcessor::acceptsMidi() const { return true; }
bool SpeakOrSpellAudioProcessor::producesMidi() const { return false; }
bool SpeakOrSpellAudioProcessor::isMidiEffect() const { return false; }
double SpeakOrSpellAudioProcessor::getTailLengthSeconds() const { return 0.2; }
int SpeakOrSpellAudioProcessor::getNumPrograms() { return 1; }
int SpeakOrSpellAudioProcessor::getCurrentProgram() { return 0; }
void SpeakOrSpellAudioProcessor::setCurrentProgram(int) {}
const juce::String SpeakOrSpellAudioProcessor::getProgramName(int) { return {}; }
void SpeakOrSpellAudioProcessor::changeProgramName(int, const juce::String&) {}
void SpeakOrSpellAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = parameters.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}
void SpeakOrSpellAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, sizeInBytes));
    if (xml != nullptr && xml->hasTagName(parameters.state.getType()))
        parameters.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SpeakOrSpellAudioProcessor();
}
