# flowkey-scraper

## I WILL NOT BE PROVIDING SUPPORT FOR THIS TOOL IN MOST CASES. THERE ARE NO GUARANTEES THIS TOOL WILL WORK IN THE FUTURE.

---

Flowkey scraping to generate sheet music pdf / music xml for a song.

![Screenshot from 2021-03-08 22-29-01](https://user-images.githubusercontent.com/8282413/110428335-f2473980-805d-11eb-80ef-329d0d868e4b.png)

## Important Notes

Currently I have found it to work at about 95% accuracy on the beginner songs that I am learning. If there are parsing errors, your best bet is to edit the score in Noteflight as needed.

This tool most likely violates the flowkey TOS, so please use at your own risk and please do not absuse the tool. I have made this tool for educational purposes (as I learn piano) since it is a useful way for me to use the flowkey arrangements.

I have heard that if you ask for sheet music from the flowkey support team that they usually will give it to you, so that might be a better approach if you are not tech-savy or are not sure about the risks.

## Getting Started

It is really easy to use this tool, just download the latest version from the [Releases Page](https://github.com/amcolash/flowkey-scraper/releases) and make sure you have Java 11 - either [JDK 11](https://www.oracle.com/java/technologies/javase-jdk11-downloads.html) OR [OpenJDK 11](https://openjdk.java.net/projects/jdk/11/) installed.

![Screenshot from 2021-03-08 22-25-59](https://user-images.githubusercontent.com/8282413/110428331-f1160c80-805d-11eb-8640-42068c32e009.png)

![Screenshot from 2021-03-08 22-26-59](https://user-images.githubusercontent.com/8282413/110428333-f1aea300-805d-11eb-9597-50e8c08bf9b8.png)

After you've downloaded the latest, just open flowkey and choose a song. There will be a new icon once you have opened a song that looks like a download icon. Just click that icon and you

## Dependencies

In order to use this project, you will need to have [JDK 11](https://www.oracle.com/java/technologies/javase-jdk11-downloads.html) / [OpenJDK 11](https://openjdk.java.net/projects/jdk/11/) installed.

## Build Dependencies

To build, you will need [nodejs](https://nodejs.org/en/) (12+) installed.

## Useful Libraries Used

- [Audiveris](https://github.com/Audiveris/audiveris) - The star of the show that does the OMR (optical music recognition)
- [Electron](https://www.electronjs.org/) / [Electron Builder](https://www.electron.build/) - Packaging / Build the tools
- [OpenCV](https://opencv.org) / [OpenCV.js](https://docs.opencv.org/3.4/d5/d10/tutorial_js_root.html) - Computer vision and processing library
- [React](https://reactjs.org/) - UI Framework
- Many more, see `package.json` for a full list
