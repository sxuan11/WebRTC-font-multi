export interface customMediaStream extends MediaStream { onDraw: Function; }

export interface StreamList {
  videoContent: HTMLVideoElement,
  text: string
}
