import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import CameraInfo from 'src/app/services/model/cameraInfo';
import { NativeService } from 'src/app/services/native.service';
import { WebrtcService } from 'src/app/services/webrtc.service';

@Component({
  selector: 'app-back',
  templateUrl: './back.component.html',
  styleUrls: ['./back.component.scss']
})
export class BackComponent implements OnInit {
  @ViewChild('showVideo') showVideo: ElementRef<HTMLVideoElement>;
  @ViewChild('realVideo') realVideo: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvas: ElementRef<HTMLCanvasElement>;

  cameraReady: boolean = false;
  realWidth: number;
  realHeight: number;
  selectedRatio: string;
  ratio: string;
  useRatio: string;
  qualityImage: number = 0.8;
  resizeWidth: number = 0;
  resizeHeight: number = 0;

  //images
  fullImage: any;
  resizeImage: any;
  rotateImage: any;
  idNumberImage: any;
  detailImage: any;

  constructor(
    private modalController: ModalController,
    private webrtcService: WebrtcService,
    private nativeService: NativeService
  ) { }

  ngOnInit(): void {
    this.ratio = this.webrtcService.ratio;
    this.useRatio = '16:9'
    this.initializeCamera(this.useRatio);
  }

  async onDismiss(data: string, role: string) {
    this.webrtcService.stopUserMedia(this.webrtcService.stream);
    this.modalController.dismiss(data, role);
    this.nativeService.Toast('ปิดกล้องแล้ว', 'bottom', 'danger', 1);
  }

  async initializeCamera(ratio: string) {
    try {
      this.nativeService.presentLoadingWithOutTime('Loading...');
      const camera = await this.webrtcService.getBackCamera();
      if (camera) {
        console.log('เรียกข้อมูลกล้องแล้ว: ', camera);
        this.openCameraByRatio(camera, ratio);
      } else {
        console.log('ไม่พบกล้อง');
        this.nativeService.presentAlert('Error', 'ไม่พบกล้อง');
        setTimeout(() => {
          this.nativeService.dismissLoading();
        }, 500);
      }
    } catch (error) {
      console.log(error);
    }
  }

  openCameraByRatio(camera: CameraInfo, ratio: string, index: number = 0) {
    const resolutions = this.webrtcService.resolutionByRatio[ratio];
    if (!resolutions) {
      console.log('Invalid ratio:', ratio);
      this.nativeService.presentAlert('Error', 'Invalid ratio');
      setTimeout(() => {
        this.nativeService.dismissLoading();
      }, 500);
    }

    if (index >= resolutions.length) {
      console.log('No suitable resolution found for the ratio:', ratio);
      this.nativeService.presentAlert('Error', 'No suitable resolution found for the ratio');
      setTimeout(() => {
        this.nativeService.dismissLoading();
      }, 500);
    }

    const resolution = resolutions[index];
    console.log('Trying to open camera with resolution:', resolution);
    let constraints = {
      video: {
        deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined,
        width: { exact: resolution.width },
        height: { exact: resolution.height },
        facingMode: camera.side === 'Front Camera' ? 'user' : 'environment',
      }
    }
    navigator.mediaDevices.getUserMedia(constraints).then((result) => {
      this.webrtcService.stream = result;
      this.showVideo.nativeElement.srcObject = this.webrtcService.stream;
      this.realVideo.nativeElement.srcObject = this.webrtcService.stream;
      this.showVideo.nativeElement.onloadeddata = () => {
        this.showVideo.nativeElement.play();
        this.realVideo.nativeElement.play();
        this.cameraReady = true;
        const { videoWidth, videoHeight } = this.realVideo.nativeElement;
        this.realWidth = videoWidth;
        this.realHeight = videoHeight;
        this.useRatio = ratio;
      }
      setTimeout(async () => {
        this.nativeService.dismissLoading();
      }, 500);
    }).catch((error) => {
      if (error.name === 'OverconstrainedError') {
        console.log('OverconstrainedError, trying next resolution...');
        this.openCameraByRatio(camera, ratio, index + 1);
      } else {
        console.log('Error opening camera:', error);
        this.nativeService.presentAlert('Error', 'Error opening camera');
        setTimeout(async () => {
          this.nativeService.dismissLoading();
        }, 500);
      }
    });
  }

  initializeRatio() {
    const ratioLookup: any = {
      '16:9': { width: 1024, height: 576 },
      '9:16': { width: 576, height: 1024 },
      '4:3': { width: 800, height: 600 },
      '3:4': { width: 600, height: 800 },
    };

    const ratio = ratioLookup[this.selectedRatio];
    if (ratio) {
      this.resizeWidth = ratio.width;
      this.resizeHeight = ratio.height;
    } else {
      this.nativeService.Toast('The ratio is incorrect. Plase select the ratio.', 'bottom', 'danger', 1);
    }
  }

  onRatioChange(event: any) {
    this.selectedRatio = event.detail.value;
    // this.onChangeCamera = this.lastedRatioInput !== this.selectedRatio;
    if (this.selectedRatio === '4:3' || this.selectedRatio === '3:4') {
      this.initializeCamera('4:3');
    } else if (this.selectedRatio === '16:9' || this.selectedRatio === '9:16') {
      this.initializeCamera('16:9');
    }

    this.resizeWidth = 0;
    this.resizeHeight = 0;
  }

  async capture() {
    const video = this.realVideo.nativeElement;
    const canvas = this.canvas.nativeElement;
    const realsizeCtx = this.canvas.nativeElement.getContext('2d');
    if (realsizeCtx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      realsizeCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', this.qualityImage);
      this.fullImage = { dataURL: dataUrl, width: canvas.width, height: canvas.height, ratio: this.selectedRatio };
    } else {
      console.log('realsizeCtx Error');
    }

    const resizeCanvas = document.createElement('canvas');
    const resizeCtx = resizeCanvas.getContext('2d');
    if (resizeCtx) {
      this.initializeRatio();
      resizeCanvas.width = this.resizeWidth;
      resizeCanvas.height = this.resizeHeight;
      if (resizeCanvas.width < 50 || resizeCanvas.height < 50) {
        console.log('resizeCanvas.width < 50 || resizeCanvas.height < 50');
      } else {
        resizeCtx.drawImage(video, 0, 0, resizeCanvas.width, resizeCanvas.height);
        const dataUrl = resizeCanvas.toDataURL('image/jpeg', this.qualityImage);
        this.resizeImage = { dataURL: dataUrl, width: resizeCanvas.width, height: resizeCanvas.height, ratio: this.selectedRatio };
      }
    } else {
      console.error('resizeCtx Error');
    }

    // rotate image
    if (this.resizeImage) {
      const image = new Image();
      image.src = this.resizeImage.dataURL;
      const loadImage = new Promise<void>((resolve) => {
        image.onload = () => resolve();
      });

      await loadImage; // Wait for the image to load
      const rotateCanvas = document.createElement('canvas');
      const rotateCtx = rotateCanvas.getContext('2d');
      if (rotateCtx) {
        rotateCanvas.width = image.height;
        rotateCanvas.height = image.width;
        rotateCtx.rotate(270 * Math.PI / 180);
        rotateCtx.translate(-rotateCanvas.height, 0);
        rotateCtx.drawImage(image, 0, 0);
        const rotatedDataURL = rotateCanvas.toDataURL('image/jpeg', this.qualityImage);
        this.rotateImage = { dataURL: rotatedDataURL, width: rotateCanvas.width, height: rotateCanvas.height, ratio: this.selectedRatio };
      }
    } else {
      this.rotateImage = null;
      console.log('not resize image');
    }

    //crop number
    if (this.rotateImage) {
      const image = new Image();
      image.src = this.rotateImage.dataURL;
      const loadImage = new Promise<void>((resolve) => {
        image.onload = () => resolve();
      });

      await loadImage;
      const idNumberCanvas = document.createElement('canvas');
      const idNumberCtx = idNumberCanvas.getContext('2d');
      if (idNumberCtx) {
        const imageWidth = image.width;
        const imageHeight = image.height;
        const idNumberSectionWidth = Math.floor(imageWidth * 0.27);
        const idNumberSectionHeight = Math.floor(imageHeight * 0.08);
        const idNumberSectionX = Math.floor(imageWidth * 0.46);
        const idNumberSectionY = Math.floor(imageHeight * 0.17);
        idNumberCanvas.width = idNumberSectionWidth;
        idNumberCanvas.height = idNumberSectionHeight;
        idNumberCtx.drawImage(image, idNumberSectionX, idNumberSectionY, idNumberSectionWidth, idNumberSectionHeight, 0, 0, idNumberSectionWidth, idNumberSectionHeight);
        const dataUrl = idNumberCanvas.toDataURL('image/jpeg', this.qualityImage);
        this.idNumberImage = { dataURL: dataUrl, width: idNumberCanvas.width, height: idNumberCanvas.height, ratio: this.selectedRatio };
      }

      const detailCanvas = document.createElement('canvas');
      const detailCtx = detailCanvas.getContext('2d');
      if (detailCtx) {
        const imageWidth = image.width;
        const imageHeight = image.height;
        const detailsWidth = Math.floor(imageWidth * 0.49);
        const detailsHeight = Math.floor(imageHeight * 0.68);
        const detailsX = Math.floor(imageWidth * 0.21);
        const detailsY = Math.floor(imageHeight * 0.24);
        detailCanvas.width = detailsWidth;
        detailCanvas.height = detailsHeight;
        detailCtx.drawImage(image, detailsX, detailsY, detailsWidth, detailsHeight, 0, 0, detailsWidth, detailsHeight);
        const dataUrl = detailCanvas.toDataURL('image/jpeg', this.qualityImage);
        this.detailImage = { dataURL: dataUrl, width: detailCanvas.width, height: detailCanvas.height, ratio: this.selectedRatio };
      }
    } else {
      console.log('not rotate image');
    }
  }

  downloadImage(dataURL: any) {
    const downloadLink = document.createElement('a');
    downloadLink.href = dataURL;
    downloadLink.download = 'image.jpg';
    downloadLink.click();
  }
}
