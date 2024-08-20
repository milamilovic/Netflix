import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewMovieComponent } from './view-movie.component';

describe('ViewMovieComponent', () => {
  let component: ViewMovieComponent;
  let fixture: ComponentFixture<ViewMovieComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ViewMovieComponent]
    });
    fixture = TestBed.createComponent(ViewMovieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
