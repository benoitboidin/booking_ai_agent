import speech_recognition as sr

def record_audio():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("Say something!")
        audio = r.listen(source)
    return audio

def process_audio(audio):
    recognizer = sr.Recognizer()
    try:
        # Use Google Web Speech API to convert audio to text
        text = recognizer.recognize_google(audio, language="en-US")
        return text
    except sr.UnknownValueError:
        return "Google Web Speech API could not understand the audio"
    except sr.RequestError as e:
        return f"Could not request results from Google Web Speech API; {e}"

if __name__ == '__main__':
    audio = record_audio()
    print("You said:", process_audio(audio))