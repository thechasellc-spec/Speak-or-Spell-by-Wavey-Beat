cmake_minimum_required(VERSION 3.22)
project(SpeakOrSpellPlugin VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")

include(FetchContent)
FetchContent_Declare(JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.10
  GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(SpeakOrSpell
  COMPANY_NAME "Wavey Beat"
  BUNDLE_ID "com.waveybeat.speakorspell.au"
  PLUGIN_MANUFACTURER_CODE WvBt
  PLUGIN_CODE SpSp
  PRODUCT_NAME "Speak or Spell"
  DESCRIPTION "Speak & Spell-inspired playable vocal synthesizer"
  IS_SYNTH TRUE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS TRUE
  COPY_PLUGIN_AFTER_BUILD FALSE
  VST3_CAN_REPLACE_VST2 FALSE
  FORMATS AU VST3 Standalone
  AU_MAIN_TYPE kAudioUnitType_MusicDevice)

juce_generate_juce_header(SpeakOrSpell)

target_sources(SpeakOrSpell PRIVATE Source/PluginProcessor.cpp Source/PluginEditor.cpp)
target_compile_definitions(SpeakOrSpell PUBLIC
  JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
target_link_libraries(SpeakOrSpell PRIVATE
  juce::juce_audio_utils
  juce::juce_audio_processors
  juce::juce_gui_extra
  PUBLIC juce::juce_recommended_config_flags
         juce::juce_recommended_lto_flags
         juce::juce_recommended_warning_flags)
