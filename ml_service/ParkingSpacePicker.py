import cv2
import pickle
import os
import argparse
import json
from datetime import datetime

class ParkingSpacePicker:
    def __init__(self, image_path, output_file='parking_spaces.pkl', width=103, height=43):
        self.image_path = image_path
        self.output_file = output_file
        self.width = width
        self.height = height
        self.posList = []
        self.dragging = False
        self.current_pos = None
        self.selected_idx = -1
        
        # Try to load existing positions if available
        self.load_positions()
        
        # Create window and set up mouse callback
        cv2.namedWindow("Parking Space Picker")
        cv2.setMouseCallback("Parking Space Picker", self.mouse_callback)
    
    def load_positions(self):
        try:
            with open(self.output_file, 'rb') as f:
                self.posList = pickle.load(f)
                print(f"Loaded {len(self.posList)} existing parking spaces.")
        except:
            self.posList = []
            print("No existing parking spaces found. Starting fresh.")
    
    def save_positions(self):
        with open(self.output_file, 'wb') as f:
            pickle.dump(self.posList, f)
        print(f"Saved {len(self.posList)} parking spaces to {self.output_file}")
    
    def export_to_json(self, json_file="parking_config.json", lot_id=1):
        """Export parking spaces to JSON format for ML service API"""
        config = {
            "lot_id": lot_id,
            "name": "Parking Lot " + str(lot_id),
            "location": "Default Location",
            "video_feed_url": "placeholder_url",
            "parking_spots": []
        }
        
        for i, pos in enumerate(self.posList):
            config["parking_spots"].append({
                "id": i + 1,  # Start IDs from 1
                "x": pos[0],
                "y": pos[1]
            })
        
        with open(json_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"Exported {len(self.posList)} parking spaces to {json_file}")
        return config
    
    def mouse_callback(self, events, x, y, flags, params):
        # Add new space on left mouse button down
        if events == cv2.EVENT_LBUTTONDOWN:
            # Check if clicking on existing space
            for i, pos in enumerate(self.posList):
                x1, y1 = pos
                if x1 < x < x1 + self.width and y1 < y < y1 + self.height:
                    self.selected_idx = i
                    self.dragging = True
                    self.current_pos = (x, y)
                    return
            
            # If not clicking on existing space, add new one
            self.posList.append((x, y))
            self.save_positions()
        
        # Start dragging on left mouse button down on existing space
        elif events == cv2.EVENT_MOUSEMOVE and self.dragging:
            dx = x - self.current_pos[0]
            dy = y - self.current_pos[1]
            if self.selected_idx >= 0 and self.selected_idx < len(self.posList):
                old_x, old_y = self.posList[self.selected_idx]
                self.posList[self.selected_idx] = (old_x + dx, old_y + dy)
                self.current_pos = (x, y)
        
        # End dragging on left mouse button up
        elif events == cv2.EVENT_LBUTTONUP:
            self.dragging = False
            self.selected_idx = -1
            self.save_positions()
        
        # Remove space on right mouse button down
        elif events == cv2.EVENT_RBUTTONDOWN:
            for i, pos in enumerate(self.posList):
                x1, y1 = pos
                if x1 < x < x1 + self.width and y1 < y < y1 + self.height:
                    self.posList.pop(i)
                    self.save_positions()
                    break
    
    def run(self):
        print("\nParking Space Picker Tool")
        print("-------------------------")
        print("Left-click: Add new parking space")
        print("Left-click + drag: Move existing space")
        print("Right-click: Delete parking space")
        print("Press 's': Save positions")
        print("Press 'e': Export to JSON for ML service")
        print("Press 'q': Quit")
        
        while True:
            # Read and resize image if needed
            img = cv2.imread(self.image_path)
            if img is None:
                print(f"Error: Could not read image {self.image_path}")
                break
            
            # Draw all parking spaces
            overlay = img.copy()
            for i, pos in enumerate(self.posList):
                x, y = pos
                # Draw rectangle with transparency
                cv2.rectangle(overlay, (x, y), (x + self.width, y + self.height), (0, 255, 0), 2)
                
                # Add space ID
                cv2.putText(overlay, str(i+1), (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Add instructions overlay
            cv2.putText(overlay, f"Spaces: {len(self.posList)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Add transparency to the drawing
            alpha = 0.7
            cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
            
            # Show image
            cv2.imshow("Parking Space Picker", img)
            
            # Handle key presses
            key = cv2.waitKey(1)
            if key == ord('q'):
                break
            elif key == ord('s'):
                self.save_positions()
            elif key == ord('e'):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                json_file = f"parking_config_{timestamp}.json"
                self.export_to_json(json_file)
        
        cv2.destroyAllWindows()
        print("Exiting Parking Space Picker")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Parking Space Picker Tool')
    parser.add_argument('--image', type=str, default='carParkImg.png', help='Path to the parking lot image')
    parser.add_argument('--output', type=str, default='CarParkPos', help='Output file for parking space positions')
    parser.add_argument('--width', type=int, default=103, help='Width of parking space box')
    parser.add_argument('--height', type=int, default=43, help='Height of parking space box')
    
    args = parser.parse_args()
    
    picker = ParkingSpacePicker(
        image_path=args.image,
        output_file=args.output,
        width=args.width,
        height=args.height
    )
    
    picker.run()