import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService } from '../movie.service';
import { HttpClient } from '@angular/common/http';
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-subscriptions',
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.css'],
})
export class SubscriptionsComponent {
  subscriptions: any;
  subscribedActors: string = '';
  subscribedGenres: string = '';
  subscribedDirectors: string = '';
  isAdmin: boolean = false;
  constructor(
    private route: ActivatedRoute,
    private movieService: MovieService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const helper = new JwtHelperService();

    const token = localStorage.getItem('idToken');

    if (token == null) {
      this.router.navigate(['/']);
      return;
    }

    const decodedToken = helper.decodeToken(token);
    const userId = decodedToken.sub;

    const role = decodedToken['custom:role'];
    this.isAdmin = role == "admin"

    this.movieService.getSubscriptions(userId).subscribe(
      (data) => {
        this.subscriptions = data.item;
        console.log('Subscriptions:', this.subscriptions);
      },
      (error) => {
        console.error('Error fetching subscriptions:', error);
      }
    );
  }

  updateSubscriptions(): void {
    this.router.navigate(['/subscriptions/update']);
  }
}
