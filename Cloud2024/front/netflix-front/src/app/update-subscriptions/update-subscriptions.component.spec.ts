import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateSubscriptionsComponent } from './update-subscriptions.component';

describe('UpdateSubscriptionsComponent', () => {
  let component: UpdateSubscriptionsComponent;
  let fixture: ComponentFixture<UpdateSubscriptionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [UpdateSubscriptionsComponent]
    });
    fixture = TestBed.createComponent(UpdateSubscriptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
