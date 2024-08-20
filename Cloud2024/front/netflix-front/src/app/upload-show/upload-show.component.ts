import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MovieService } from '../movie.service';
import {UserService} from "../user.service";
import { JwtHelperService } from '@auth0/angular-jwt';
import {Router} from "@angular/router";

@Component({
  selector: 'app-upload-show',
  templateUrl: './upload-show.component.html',
  styleUrls: ['./upload-show.component.css']
})
export class UploadShowComponent {
  title: string = '';
  description: string = '';
  actors: string = '';
  directors: string = '';
  genres: string = '';
  fileContent: File | null = null;
  fileName: string = '';
  fileType: string = '';
  fileSizeMb: number = 0;
  newId: string = '';
  thumbnailImageBase64: string = '';
  thumbnailImage: File | null = null;
  seasonNumber: number = 1;
  episodeNumber: number = 1;
  episodeTitle: string = '';
  episodeDescription: string = '';
  episodeThumbnailBase64: string = '';
  episodeThumbnail: File | null = null;
  videoQuality: string = '';
  isAdmin: boolean = false;

  constructor(private http: HttpClient,
              private movieService: MovieService,
              private userService: UserService,
              private router: Router,
  ) {}

  ngOnInit() {
    const token = localStorage.getItem("idToken")
    if (token == null) {
      this.router.navigate(['/']);
      return;
    }
    const helper = new JwtHelperService();
    const decodedToken = helper.decodeToken(token);
    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"
  }

  onImageChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== "image/jpeg" && file.type !== "image/png") {
        alert('Please use a valid image type (jpeg or png)!');
        return;
      }
      this.thumbnailImage = file;
      this.toBase64(file).then(base64 => this.thumbnailImageBase64 = base64);
    } else {
      this.thumbnailImage = null;
      this.thumbnailImageBase64 = '';
    }
  }

  onEpisodeThumbnailChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== "image/jpeg" && file.type !== "image/png") {
        alert('Please use a valid image type (jpeg or png)!');
        return;
      }
      this.episodeThumbnail = file;
      this.toBase64(file).then(base64 => this.episodeThumbnailBase64 = base64);
    } else {
      this.episodeThumbnail = null;
      this.episodeThumbnailBase64 = '';
    }
  }

  onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== "video/mp4") {
        alert('Please use a supported video type (mp4)!');
        return;
      }
      this.fileContent = file;
      this.fileName = file.name;
      this.fileType = file.type;
      this.fileSizeMb = Math.round(file.size / (1024 * 1024)); // Convert to MB

      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';

      videoElement.onloadedmetadata = () => {
        URL.revokeObjectURL(videoElement.src);
        this.videoQuality = videoElement.videoWidth + "-" + videoElement.videoHeight;
      };

      videoElement.src = URL.createObjectURL(file);
    } else {
      this.fileContent = null;
      this.fileName = '';
      this.fileType = '';
      this.fileSizeMb = 0;
      this.videoQuality = '';
    }
  }

   async doesTitleExist(title: string):Promise<boolean>  {
     return new Promise<boolean>((resolve, reject) => {
       this.movieService.checkMovie(title).subscribe({
         next: (response: any) => {
           console.log(response);
           if (response === true) {
             alert("Movie with this title already exists! Please enter a different title!");
             resolve(true);
           } else if (response === 'Title not found') {
             resolve(false);
           } else {
             alert("Show with this title already has this episode! Please try updating!");
             resolve(true);
           }
         },
         error: (err) => {
           console.log(err);
           reject(err); // Propagate the error
         }
       });
     });
  }

  async onSubmit() {
    if (!this.fileContent) {
      alert('Please select a file to upload');
      return;
    }
    if (!this.episodeThumbnail) {
      alert('Please select episode thumbnail image to upload');
      return;
    }

    if (this.episodeNumber <= 0) {
      alert('Invalid episode number!');
      return;
    }
    if (this.seasonNumber <= 0) {
      alert('Invalid season number!');
      return;
    }

    let title = this.title.replace(/\s+/g, '-').toLowerCase();

    try {

      if (await this.doesTitleExist(title)) {
        console.log("postoji")
        return;
      }
      else {
        // Handle description and thumbnail for s1e1
        if (!(this.episodeNumber === 1 && this.seasonNumber === 1)) {
          if (this.description !== '' || this.thumbnailImageBase64 !== '') {
            alert('Description and thumbnail are only for s1e1 and will be ignored');
            this.description = '';
            this.thumbnailImage = null;
            this.thumbnailImageBase64 = '';
          }
        } else {
          if (this.description === '' || this.thumbnailImageBase64 === '') {
            alert('Description and thumbnail are required for s1e1!');
            return;
          }
        }

        // Upload metadata only if checks pass
        const fileContentBase64 = await this.toBase64(this.fileContent);
        this.newId = this.generateId().toString();
        console.log(this.newId)
        const videoQualities = ['256-144', '426-240', '480-360'];
        if (!videoQualities.includes(this.videoQuality)) {
          videoQualities.push(this.videoQuality);
        }

        const metadata = {
          id: this.newId,
          fileName: this.fileName,
          title: title,
          description: this.description,
          actors: this.actors.split(',').map(actor => actor.trim()),
          directors: this.directors.split(',').map(director => director.trim()),
          genres: this.genres.split(',').map(genre => genre.trim()),
          fileType: this.fileType,
          fileSizeMb: this.fileSizeMb,
          thumbnailImage: this.thumbnailImageBase64,
          seasonNumber: this.seasonNumber,
          episodeNumber: this.episodeNumber,
          episodeTitle: this.episodeTitle,
          episodeDescription: this.episodeDescription,
          episodeThumbnail: this.episodeThumbnailBase64,
          qualities: videoQualities
        };

        console.log(metadata)
        // Upload metadata and video
        this.movieService.uploadMetadata(metadata).subscribe(
          (response) => {
            console.log('Metadata uploaded successfully', response);
            this.uploadVideo(this.newId, fileContentBase64, metadata.qualities); // Only upload video if metadata upload is successful
          },
          (error) => {
            console.error('Error uploading metadata', error);
          }
        );
      }
    } catch (error) {
      console.error('Error converting file to base64:', error);
    }
  }

  toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (reader.result) {
          resolve(reader.result.toString().split(',')[1]);
        } else {
          reject(new Error('FileReader result is null'));
        }
      };
      reader.onerror = error => reject(error);
    });
  }

  generateId(): number {
    return Math.floor(Math.random() * 1000000);
  }

  uploadMetadata(metadata: any) {
    console.log(metadata)
    this.movieService.uploadMetadata(metadata).subscribe((response) => {
      console.log('Metadata uploaded successfully', response);
    }, error => {
      console.error('Error uploading metadata', error);
    });
  }

  uploadVideo(id: string, fileContentBase64: string, qualities: string[]) {
    // Iterate through each quality
    qualities.forEach(quality => {
      let width = quality.split("-")[0];
      let height = quality.split("-")[1];
      const payload = {
        id: id,
        fileContent: fileContentBase64,
        width: width,
        height: height
      };
      this.movieService.uploadVideo(payload).subscribe((response) => {
          console.log('Video started uploading', response);
        },
        (error) => {
          console.error('Error uploading video', error);
          // If video upload fails after successful metadata upload, delete the metadata
          this.movieService.deleteMetadata(id).subscribe(
            (response) => {
              console.log('Metadata deleted successfully', response);
              alert(`Upload of video failed. Metadata deleted.`);
              return;
            },
            (deleteError) => {
              console.error('Error deleting metadata', deleteError);
            }
          );
        }
      );
    })
    this.userService.generateFeedForAll().subscribe({
      next: (response : any) => {
        console.log('generating feed for all users...');
        for(let username in response){
          this.userService.generateFeed(response[username]).subscribe({
            next: (response1 : any) => {
              console.log('generating feed for ' , response[username]);
            },
            error: (err: any) => {
              console.error('Error generating feed for : ',response[username], err)
            }
          });
        }
      },
      error: (err: any) => {
        console.error('Error generating feed for all users: ', err)
      }
    });
    alert("started uploading successfully!");
  }
}
