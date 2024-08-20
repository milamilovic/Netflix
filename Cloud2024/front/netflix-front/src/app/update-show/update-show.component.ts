import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { MovieService } from '../movie.service';
import { ActivatedRoute, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-update-show',
  templateUrl: './update-show.component.html',
  styleUrls: ['./update-show.component.css'],
})
export class UpdateShowComponent {
  show: any;
  originalShow: any;
  isAdmin: boolean = false;

  title: string = '';
  description: string = '';
  actors: string = '';
  directors: string = '';
  genres: string = '';
  fileContent: File | null = null;
  fileName: string = '';
  fileType: string = '';
  fileSizeMb: number = 0;
  thumbnailImageBase64: string = '';
  thumbnailImage: File | null = null;
  seasonNumber: number = 1;
  episodeNumber: number = 1;
  episodeTitle: string = '';
  episodeDescription: string = '';
  episodeThumbnailBase64: string = '';
  episodeThumbnail: File | null = null;
  videoQuality: string = '';

  isVideoChanged: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private movieService: MovieService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem("idToken")
    if (token == null) {
      this.router.navigate(['/']);
      return;
    }
    const helper = new JwtHelperService();
    const decodedToken = helper.decodeToken(token);
    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.movieService.getMovie(id).subscribe(
        (data) => {
          this.show = data;
          this.originalShow = structuredClone(data);
          this.title = this.show.title;
          this.description = this.show.description;
          this.actors = this.show.actors.join(', '); // Convert array to comma-separated string
          this.directors = this.show.directors.join(', '); // Convert array to comma-separated string
          this.genres = this.show.genres.join(', '); // Convert array to comma-separated string
          this.thumbnailImageBase64 = this.show.thumbnailImage;
          this.fileName = this.show.fileName;
          this.fileType = this.show.fileType;
          this.fileSizeMb = this.show.fileSizeMb;
          this.seasonNumber = this.show.seasonNumber;
          this.episodeNumber = this.show.episodeNumber;
          this.episodeTitle = this.show.episodeTitle;
          this.episodeDescription = this.show.episodeDescription;
          this.episodeThumbnailBase64 = this.show.episodeThumbnail;
        },
        (error) => {
          console.error('Error fetching tv show:', error);
          this.router.navigate(['/']);
        }
      );
    }
  }

  onImageChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        alert('Please use a valid image type (jpeg or png)!');
        return;
      }
      this.thumbnailImage = file;
      this.toBase64(file).then(
        (base64) => (this.thumbnailImageBase64 = base64)
      );
    } else {
      this.thumbnailImage = null;
      this.thumbnailImageBase64 = this.show.thumbnailImage;
    }
  }

  onEpisodeThumbnailChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        alert('Please use a valid image type (jpeg or png)!');
        return;
      }
      this.episodeThumbnail = file;
      this.toBase64(file).then(
        (base64) => (this.episodeThumbnailBase64 = base64)
      );
    } else {
      this.episodeThumbnail = null;
      this.episodeThumbnailBase64 = this.show.episodeThumbnail;
    }
  }

  onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = (target.files && target.files[0]) || null;
    if (file) {
      if (file.type !== 'video/mp4') {
        alert('Please use a supported video type (mp4)!');
        return;
      }
      this.isVideoChanged = true;
      this.fileContent = file;
      this.fileName = file.name;
      this.fileType = file.type;
      this.fileSizeMb = Math.round(file.size / (1024 * 1024)); // Convert to MB

      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';

      videoElement.onloadedmetadata = () => {
        URL.revokeObjectURL(videoElement.src);
        this.videoQuality =
          videoElement.videoWidth + '-' + videoElement.videoHeight;
      };
      videoElement.src = URL.createObjectURL(file);
    } else {
      this.isVideoChanged = false;
      this.fileContent = null;
      this.fileName = this.show.fileName;
      this.fileType = this.show.fileType;
      this.fileSizeMb = this.show.fileSizeMb;
      this.videoQuality = '';
    }
  }

  async onSubmit() {
    if (!this.isFormValid()) {
      alert('All fields must be filled.');
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

    if (!(this.episodeNumber == 1 && this.seasonNumber == 1)) {
      if (this.description != '' || this.thumbnailImageBase64 != '') {
        alert(
          'Description and thumbnail are only for s1e1 and will be ignored'
        );
        this.description = '';
        this.thumbnailImage = null;
        this.thumbnailImageBase64 = '';
      }
    }

    if (this.episodeNumber == 1 && this.seasonNumber == 1) {
      if (this.description == '' || this.thumbnailImageBase64 == '') {
        alert('Description and thumbnail are required for s1e1!');
        return;
      }
    }

    try {
      let fileContentBase64: string;
      if (this.fileContent) {
        fileContentBase64 = await this.toBase64(this.fileContent);
      }

      if (this.isVideoChanged) {
        const videoQualities = ['256-144', '426-240', '480-360'];
        if (!videoQualities.includes(this.videoQuality)) {
          videoQualities.push(this.videoQuality);
        }
        console.log(videoQualities);
        this.show.qualities = videoQualities;
      }

      this.show.title = this.title;
      this.show.description = this.description;
      this.show.actors = this.actors.split(',').map((actor) => actor.trim());
      this.show.directors = this.directors
        .split(',')
        .map((director) => director.trim());
      this.show.genres = this.genres.split(',').map((genre) => genre.trim());
      this.show.thumbnailImage = this.thumbnailImageBase64;
      this.show.fileName = this.fileName;
      this.show.fileType = this.fileType;
      this.show.fileSizeMb = this.fileSizeMb;
      this.show.seasonNumber = this.seasonNumber;
      this.show.episodeNumber = this.episodeNumber;
      this.show.episodeTitle = this.episodeTitle;
      this.show.episodeDescription = this.episodeDescription;
      this.show.episodeThumbnail = this.episodeThumbnailBase64;

      this.movieService.updateMetadata(this.show).subscribe(
        (response) => {
          console.log('Metadata updated successfully', response);
          if (this.isVideoChanged) {
            this.updateVideo(
              this.show.id,
              fileContentBase64,
              this.show.qualities
            );
          } else {
            alert('Metadata updated successfully!');
          }
        },
        (error) => {
          console.error('Error updating metadata', error);
          alert('Error updating metadata!');
        }
      );
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
      reader.onerror = (error) => reject(error);
    });
  }

  generateId(): number {
    return Math.floor(Math.random() * 1000000);
  }

  async onDelete() {
    if (!confirm('Are you sure you want to delete this episode?')) {
      return;
    }

    try {
      this.movieService.deleteMetadata(this.show.id).subscribe(
        (response) => {
          console.log('Metadata deleted successfully', response);
          this.deleteVideo(this.originalShow.id, this.originalShow.qualities);
        },
        (error) => {
          console.error('Error deleting metadata', error);
          alert('Error deleting metadata!');
        }
      );
    } catch (error) {
      console.error('Error: ', error);
    }
  }

  updateVideo(id: string, fileContentBase64: string, qualities: string[]) {
    let originalVideos: any[] = [];
    let uploadedVideos: string[] = [];

    const fetchPromises = this.originalShow.qualities.map((quality: string) => {
      let width = quality.split('-')[0];
      let height = quality.split('-')[1];
      const movieId = this.originalShow.id + '_' + width + '-' + height;

      return new Promise<void>((resolve, reject) => {
        this.movieService.downloadMovie(movieId).subscribe(
          (response) => {
            originalVideos.push({ quality, data: response });
            resolve();
          },
          (error) => {
            console.error('Error fetching original video', error);
            reject(error);
          }
        );
      });
    });
    Promise.all(fetchPromises)
      .then(() => {
        return this.deleteExistingVideo(
          this.originalShow.id,
          this.originalShow.qualities
        );
      })
      .then(() => {
        const uploadPromises = qualities.map((quality) => {
          let width = quality.split('-')[0];
          let height = quality.split('-')[1];
          const payload = {
            id: id,
            fileContent: fileContentBase64,
            width: width,
            height: height,
          };

          return new Promise((resolve, reject) => {
            this.movieService.uploadVideo(payload).subscribe(
              (response) => {
                console.log('Video updated successfully', response);
                uploadedVideos.push(quality);
                resolve(response);
              },
              (error) => {
                console.error('Error updating video', error);
                alert('Error updating video!');
                reject(error);
              }
            );
          });
        });

        return Promise.all(uploadPromises);
      })
      .then(() => {
        alert('Movie started uploading!');
      })
      .catch((error) => {
        console.error('Error during update process', error);
        alert('Error during update process. Reverting to original state.');

        // Delete the newly uploaded videos
        const deletePromises = uploadedVideos.map((quality: string) => {
          let width = quality.split('-')[0];
          let height = quality.split('-')[1];
          const movieId = id + '_' + width + '-' + height;

          return new Promise<void>((resolve, reject) => {
            this.movieService.deleteVideo(movieId).subscribe(
              (response) => {
                console.log('New video deleted successfully', response);
                resolve();
              },
              (error) => {
                console.error('Error deleting new video', error);
                reject(error);
              }
            );
          });
        });

        Promise.all(deletePromises)
          .then(() => {
            const restorePromises = originalVideos.map((video) => {
              let width = video.quality.split('-')[0];
              let height = video.quality.split('-')[1];
              const payload = {
                id: this.originalShow.id,
                fileContent: video.data,
                width: width,
                height: height,
              };

              return new Promise((resolve, reject) => {
                this.movieService.uploadVideo(payload).subscribe(
                  (response) => {
                    console.log(
                      'Original video restored successfully',
                      response
                    );
                    resolve(response);
                  },
                  (error) => {
                    console.error('Error restoring original video', error);
                    reject(error);
                  }
                );
              });
            });

            return Promise.all(restorePromises);
          })
          .then(() => {
            this.movieService.updateMetadata(this.originalShow).subscribe(
              (response) => {
                console.log('Metadata uploaded successfully', response);
              },
              (error) => {
                console.error('Error uploading metadata', error);
              }
            );
            alert('Original state restored.');
          });
      });
  }

  deleteExistingVideo(id: string, qualities: string[]): Promise<void> {
    const deletePromises = qualities.map((quality) => {
      let width = quality.split('-')[0];
      let height = quality.split('-')[1];
      const movieId = id + '_' + width + '-' + height;

      return new Promise<void>((resolve, reject) => {
        this.movieService.deleteVideo(movieId).subscribe(
          (response) => {
            console.log('Video deleted successfully', response);
            resolve();
          },
          (error) => {
            console.error('Error deleting video', error);
          }
        );
      });
    });

    return Promise.all(deletePromises)
      .then(() => {
        console.log('Video Deleted Successfully!');
      })
      .catch((error) => {
        console.error('Error during deletion process', error);
        console.log('Error deleting video!');
      });
  }

  deleteVideo(id: string, qualities: string[]) {
    let deletedVideos: any[] = [];
    let deletePromises: Promise<any>[] = [];

    // Fetch existing videos before deletion
    const fetchPromises = qualities.map((quality) => {
      let width = quality.split('-')[0];
      let height = quality.split('-')[1];
      const movieId = id + '_' + width + '-' + height;

      // Return a promise to fetch movie details
      return new Promise<void>((resolve, reject) => {
        this.movieService.downloadMovie(movieId).subscribe(
          (response) => {
            console.log('Video fetched successfully before deletion');
            deletedVideos.push({ quality, response });
            resolve();
          },
          (error) => {
            console.error('Error fetching video before deletion', error);
            reject(error);
          }
        );
      });
    });

    Promise.all(fetchPromises)
      .then(() => {
        qualities.forEach((quality) => {
          let width = quality.split('-')[0];
          let height = quality.split('-')[1];
          const movieId = id + '_' + width + '-' + height;

          const deletePromise = new Promise<void>((resolve, reject) => {
            this.movieService.deleteVideo(movieId).subscribe(
              (response) => {
                console.log('Video deleted successfully', response);
                resolve();
              },
              (error) => {
                console.error('Error deleting video', error);
                reject(error);
              }
            );
          });

          deletePromises.push(deletePromise);
        });

        Promise.all(deletePromises)
          .then(() => {
            alert('Videos Deleted Successfully!');
            this.router.navigate(['/']);
          })
          .catch((error) => {
            console.error('Error deleting videos', error);
            alert('Error deleting videos!');

            const rollbackPromises = deletedVideos.map((deletedVideo) => {
              let width = deletedVideo.quality.split('-')[0];
              let height = deletedVideo.quality.split('-')[1];
              const payload = {
                id: id,
                fileContent: deletedVideo.response,
                width: width,
                height: height,
              };

              return new Promise<void>((resolve, reject) => {
                this.movieService.uploadVideo(payload).subscribe(
                  (response) => {
                    console.log('Video restored successfully', response);
                    resolve();
                  },
                  (error) => {
                    console.error('Error restoring video', error);
                    reject(error);
                  }
                );
              });
            });

            Promise.all(rollbackPromises)
              .then(() => {
                this.movieService.uploadMetadata(this.originalShow).subscribe(
                  (response) => {
                    console.log('Metadata uploaded successfully', response);
                  },
                  (error) => {
                    console.error('Error uploading metadata', error);
                  }
                );
                alert('Videos restored to original state.');
              })
              .catch((error) => {
                console.error('Error during rollback', error);
                alert(
                  'Error during rollback! Some videos may not have been restored.'
                );
              });
          });
      })
      .catch((error) => {
        console.error('Error fetching videos before deletion', error);
        alert('Error fetching videos before deletion!');
      });
  }

  isFormValid() {
    return (
      this.title.trim() !== '' &&
      this.description.trim() !== '' &&
      this.actors.trim() !== '' &&
      this.directors.trim() !== '' &&
      this.genres.trim() !== '' &&
      this.episodeTitle.trim() !== '' &&
      this.episodeDescription.trim() !== ''
    );
  }
}
