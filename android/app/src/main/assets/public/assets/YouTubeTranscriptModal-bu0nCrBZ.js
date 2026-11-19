import "./rolldown-runtime-oLLnCvco.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { p as extractYouTubeIdFromInput } from "./index-DaFzEGR-.js";
import { StudyWorkspace } from "./StudyWorkspace-BpbzkyyV.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var YouTubeTranscriptModal = ({ videoId, videoTitle, videoAuthor, isOpen = true, onClose, isDark = true, onAskKinich, video }) => {
	if (!isOpen) return null;
	const resolvedVideo = {
		videoId: videoId || video?.videoId || (video?.videoUrl ? extractYouTubeIdFromInput(video.videoUrl) || void 0 : void 0) || (video?.link ? extractYouTubeIdFromInput(video.link) || void 0 : void 0),
		title: video?.title || videoTitle || "Study Space",
		author: video?.author || videoAuthor || "YouTube",
		videoUrl: video?.videoUrl,
		thumbnail: video?.thumbnail,
		link: video?.link,
		transcript: video?.transcript
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 w-full h-[100dvh] overflow-hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudyWorkspace, {
			initialVideo: resolvedVideo,
			onBackToChat: onClose,
			isDark,
			onAskKinich
		})
	});
};
//#endregion
export { YouTubeTranscriptModal };
